const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '../js/workspace-store.js');
assert.ok(fs.existsSync(file), 'workspace store must persist a whole consistent workspace');
const { createWorkspaceStore, PREFIX } = require(file);
const C = require('../js/workspace-core.js');
const { createStorage } = require('../js/storage.js');
const copy = value => JSON.parse(JSON.stringify(value));
function environment() {
  const values = new Map(), records = new Map();
  const env = { values, records, failLocal: false, failDB: false,
    localStorage: { getItem: key => values.get(key) ?? null, setItem(key, value) { if (env.failLocal) throw new Error('quota'); values.set(key, String(value)); }, removeItem: key => values.delete(key) },
    navigator: { locks: { request: async (_name, fn) => fn() } },
    recordStore: {
      async getAll() { return env.failDB ? { ok: false, error: { code: 'unavailable', message: 'DB unavailable' } } : { ok: true, value: [...records.values()].map(copy) }; },
      async put(value) { if (env.failDB) return { ok: false, error: { code: 'unavailable', message: 'DB failed' } }; records.set(value.id, copy(value)); return { ok: true }; },
      async compareAndPut(value, revision, extras = []) {
        if (env.failDB) return { ok: false, error: { code: 'unavailable', message: 'DB failed' } };
        if ((records.get('workspace')?.revision || 0) !== revision) return { ok: false, error: { code: 'conflict', message: 'conflict' } };
        for (const item of extras) records.set(item.id, copy(item));
        records.set(value.id, copy(value)); return { ok: true };
      },
    },
  };
  env.storage = createStorage(env); return env;
}
(async () => {
  const env = environment(), store = createWorkspaceStore(env);
  assert.equal((await store.ready).ok, true);
  let state = store.read(); state.shared = { sample: 1 };
  assert.equal((await store.commit(state, 0)).ok, true);
  assert.equal(store.read().revision, 1);
  state.shared.sample = 99;
  assert.equal(store.read().shared.sample, 1);
  const point = await store.createRecoveryPoint({ projects: [] });
  assert.equal(point.ok, true);
  assert.equal((await store.readRecoveryPoint(point.value.id)).value.state.shared.sample, 1);
  env.failLocal = env.failDB = true;
  const changed = store.read(); changed.shared.sample = 2;
  assert.equal((await store.commit(changed, 1)).ok, false);
  assert.equal(store.read().shared.sample, 1, 'failed write does not update durable-state cache');
  env.failDB = false;
  assert.equal((await store.commit(changed, 1)).ok, true, 'DB success despite local quota');
  const other = createWorkspaceStore(env); await other.ready;
  const stale = store.read(); stale.shared.sample = 4;
  const fresh = other.read(); fresh.shared.sample = 3;
  assert.equal((await other.commit(fresh, 2)).ok, true);
  assert.equal((await store.commit(stale, 2)).error.code, 'conflict');
  const root = copy(env.records.get('workspace'));
  const divergent = { ...root, commitId: 'different-commit', shared: { sample: 404 } };
  env.failLocal = false;
  env.values.set(PREFIX + 'data:different-commit', JSON.stringify(divergent));
  env.values.set(PREFIX + 'head', 'different-commit');
  const conflict = createWorkspaceStore(env);
  assert.equal((await conflict.ready).ok, false, 'equal revision divergent durable copies never silently overwrite');
  assert.equal(conflict.conflicts().length, 2);
  assert.equal(env.records.get('workspace').shared.sample, 3);
  assert.equal((await conflict.commit(C.createWorkspace(), 0)).ok, false);
  assert.equal(typeof conflict.repair, 'function', 'explicit recovery must repair blocked stores without enabling autosave');
  assert.equal((await conflict.repair(C.createWorkspace(), false)).ok, false, 'repair requires confirmation');
  assert.equal((await conflict.repair(C.createWorkspace(), true)).ok, true);
  assert.ok(conflict.read().preserved.length >= 2, 'conflicting raw roots retained in replacement');
  const damagedEnv = environment(); damagedEnv.records.set('workspace', { id: 'workspace', schemaVersion: 999, revision: 7, raw: 'keep me' });
  const damaged = createWorkspaceStore(damagedEnv); assert.equal((await damaged.ready).ok, false);
  assert.ok(damaged.conflicts().length, 'malformed raw record retained for export');
  assert.equal((await damaged.repair(C.createWorkspace(), true)).ok, true);
  assert.equal(damaged.read().preserved.some(item => item.value?.raw?.includes('keep me')), true);
  const reopened = createWorkspaceStore(damagedEnv); assert.equal((await reopened.ready).ok, true);
  const fallbackEnv = environment(); fallbackEnv.failDB = true;
  const fallback = createWorkspaceStore(fallbackEnv); await fallback.ready;
  assert.equal((await fallback.commit(C.createWorkspace(), 0)).ok, true);
  const reloaded = createWorkspaceStore(fallbackEnv); await reloaded.ready;
  assert.equal(reloaded.read().revision, 1);
  fallbackEnv.failLocal = true;
  assert.equal((await reloaded.commit(reloaded.read(), 1)).ok, false);
  assert.equal(reloaded.read().revision, 1);
  console.log('PASS workspace store: durable failure, quota fallback, detached snapshots, recovery points and conflicts');
})().catch(error => { console.error(error); process.exitCode = 1; });
