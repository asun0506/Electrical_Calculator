const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStorage, ERROR_CODES } = require('../js/storage.js');

function memoryStorage() {
  const values = new Map();
  return { values, localStorage: {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } };
}

(async () => {
  const { values, localStorage } = memoryStorage();
  const storage = createStorage({ localStorage });
  assert.equal(storage.writeJson('sample', { value: 42 }).ok, true);
  assert.deepEqual(storage.readJson('sample'), { ok: true, value: { value: 42 }, source: 'sample', error: null });
  values.set('broken', '{');
  assert.equal(storage.readJson('broken').error.code, ERROR_CODES.MALFORMED);
  assert.equal(storage.readJson('missing').value, null);
  assert.equal(storage.readJson('missing', { defaultValue: 7 }).value, 7);
  assert.equal(storage.readJson('sample', { validate: value => value.value === 0 }).error.code, ERROR_CODES.INVALID);
  assert.equal(storage.readJson('sample', { validate() { throw new Error('invalid'); } }).error.code, ERROR_CODES.INVALID);
  assert.equal(storage.remove('sample').ok, true);
  assert.equal(values.has('sample'), false);
  assert.equal(storage.writeText('active', 'bolt').ok, true);
  assert.equal(values.get('active'), 'bolt', 'raw active calculator remains compatible');
  assert.equal(storage.readText('active').value, 'bolt');
  assert.deepEqual(storage.keys('act').value, ['active']);

  const quota = createStorage({ localStorage: { ...localStorage, setItem() { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); } } });
  assert.equal(quota.writeJson('sample', {}).error.code, ERROR_CODES.QUOTA);
  for (const unavailable of [createStorage({}), createStorage({ get localStorage() { throw new Error('denied'); } })]) {
    assert.equal(unavailable.readJson('sample').error.code, ERROR_CODES.UNAVAILABLE);
    assert.equal(unavailable.writeJson('sample', {}).error.code, ERROR_CODES.UNAVAILABLE);
    assert.equal(unavailable.remove('sample').error.code, ERROR_CODES.UNAVAILABLE);
    assert.equal(unavailable.keys().error.code, ERROR_CODES.UNAVAILABLE);
    const store = unavailable.openObjectStore({ database: 'test', version: 1, store: 'drafts', keyPath: 'id' });
    assert.equal((await store.ready).ok, false);
    assert.equal((await store.getAll()).error.code, ERROR_CODES.UNAVAILABLE);
    assert.equal((await store.put({ id: 'x' })).error.code, ERROR_CODES.UNAVAILABLE);
    assert.equal((await store.remove('x')).error.code, ERROR_CODES.UNAVAILABLE);
  }
  const circular = {}; circular.self = circular;
  assert.equal(storage.writeJson('circular', circular).error.code, ERROR_CODES.INVALID);
  assert.equal(storage.writeJson('undefined', undefined).error.code, ERROR_CODES.INVALID);

  values.set('legacy', '{"value":42}');
  const options = { validate: value => value && value.value === 42 };
  assert.deepEqual(storage.readWithLegacy('current', ['legacy'], options), { ok: true, value: { value: 42 }, source: 'legacy', error: null });
  assert.equal(values.get('current'), '{"value":42}');
  assert.equal(values.get('legacy'), '{"value":42}', 'successful migration retains legacy');
  assert.equal(storage.readWithLegacy('current', ['legacy'], options).source, 'current');
  values.set('invalid-legacy', '{"value":0}');
  assert.equal(storage.readWithLegacy('invalid-current', ['invalid-legacy'], options).error.code, ERROR_CODES.INVALID);
  assert.equal(values.has('invalid-current'), false);
  const failed = quota.readWithLegacy('failed-current', ['legacy'], options);
  assert.equal(failed.error.code, ERROR_CODES.MIGRATION);
  assert.deepEqual(failed.value, { value: 42 }, 'failed migration still restores validated legacy');
  assert.equal(failed.source, 'legacy');
  assert.equal(values.has('failed-current'), false);
  assert.equal(values.get('legacy'), '{"value":42}');
  console.log('PASS storage result contracts, errors, validation, legacy migration and preservation');

  // Loading existing future-dated drafts must preserve monotonicity despite a backwards clock.
  values.set('electrical_toolkit_draft_v1:bolt', JSON.stringify({ id: 'bolt', version: 1, updatedAt: 9000, payload: { value: 1 } }));
  const window = { ElectricalStorage: storage };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/drafts.js'), 'utf8'), {
    window, localStorage, Date: { now: () => 100 }, Map, JSON,
  });
  await window.CalculatorDrafts.ready;
  await window.CalculatorDrafts.write('bolt', { value: 2 });
  assert.equal(JSON.parse(values.get('electrical_toolkit_draft_v1:bolt')).updatedAt, 9001);
  await window.CalculatorDrafts.write('bolt', { value: 3 });
  assert.equal(JSON.parse(values.get('electrical_toolkit_draft_v1:bolt')).updatedAt, 9002);
  const payload = { value: { nested: 4 } };
  await window.CalculatorDrafts.write('bolt', payload);
  payload.value.nested = 99;
  assert.equal(window.CalculatorDrafts.read('bolt').value.nested, 4, 'draft detached from live state');
  console.log('PASS monotonic draft timestamps and detached payload');
})().catch(error => { console.error(error); process.exitCode = 1; });
