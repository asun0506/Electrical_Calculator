/* Durable workspace commits. A failed write never advances the in-memory durable head. */
(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./workspace-core.js'), require('./storage.js'));
  else window.ElectricalWorkspaceStore = factory(window.ElectricalWorkspaceCore, { createStorage: () => window.ElectricalStorage });
})(function (C, storageAPI) {
  'use strict';
  const PREFIX = 'electrical_workspace_v1:';
  const uid = () => globalThis.crypto?.randomUUID?.() || 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  function createWorkspaceStore(environment = {}) {
    const storage = environment.storage || storageAPI.createStorage(environment);
    const records = environment.recordStore || storage.openObjectStore({ database: 'electrical-toolkit-workspaces', version: 1, store: 'records', keyPath: 'id' });
    let current = C.createWorkspace(), conflicts = [], blocked = null, points = [], queue = Promise.resolve();
    function readLocal() {
      const head = storage.readText(PREFIX + 'head');
      if (!head.ok) return head;
      if (!head.value) return C.ok(null);
      const result = storage.readJson(PREFIX + 'data:' + head.value);
      if (!result.ok) return result;
      if (!C.validateWorkspace(result.value).ok || result.value.commitId !== head.value) return C.fail('本地工作区副本无效，请从备份恢复', 'malformed');
      return C.ok(result.value);
    }
    function reconcile(dbResult, localResult) {
      const dbState = dbResult.ok ? dbResult.value.find(item => item.id === 'workspace') : null;
      if (dbState && !C.validateWorkspace(dbState).ok) return C.fail('IndexedDB 工作区数据无效，请保留并导出原始数据', 'malformed');
      const localState = localResult.ok ? localResult.value : null;
      if (dbState && localState && dbState.revision === localState.revision && JSON.stringify(dbState) !== JSON.stringify(localState)) {
        conflicts = [C.clone(dbState), C.clone(localState)];
        return C.fail('浏览器两份工作区数据冲突，请导出冲突副本后再恢复', 'conflict');
      }
      if (!dbState && !localState && ((!localResult.ok && localResult.error.code !== 'unavailable') || (dbResult.ok && dbState))) return C.fail('无法读取现有工作区，请从备份恢复', 'malformed');
      const found = [dbState, localState].filter(Boolean).sort((a, b) => b.revision - a.revision)[0];
      return C.ok({ state: found || C.createWorkspace(), dbRevision: dbState?.revision || 0 });
    }
    const ready = records.getAll().then(result => {
      if (result.ok) points = result.value.filter(item => item.kind === 'recovery-point');
      const selection = reconcile(result, readLocal());
      if (!selection.ok) { blocked = selection; return selection; }
      current = C.clone(selection.value.state); return C.ok(C.clone(current));
    });
    function localCommit(next, extras = []) {
      for (const item of extras) {
        const written = storage.writeJson(PREFIX + 'point:' + item.id, item);
        if (!written.ok) return written;
        if (JSON.stringify(storage.readJson(PREFIX + 'point:' + item.id).value) !== JSON.stringify(item)) return C.fail('恢复点读回失败', 'unavailable');
      }
      const written = storage.writeJson(PREFIX + 'data:' + next.commitId, next);
      if (!written.ok) return written;
      if (JSON.stringify(storage.readJson(PREFIX + 'data:' + next.commitId).value) !== JSON.stringify(next)) return C.fail('工作区读回失败', 'unavailable');
      return storage.writeText(PREFIX + 'head', next.commitId);
    }
    async function persist(next, expectedRevision, extras = []) {
      await ready;
      if (blocked) return blocked;
      if (!C.validateWorkspace(next).ok) return C.fail('无法保存无效工作区');
      const operation = async () => {
        const dbResult = await records.getAll(), localResult = readLocal();
        const selection = reconcile(dbResult, localResult);
        if (!selection.ok) return selection;
        const root = selection.value.state;
        if (root.revision !== expectedRevision || root.commitId !== current.commitId || current.revision !== expectedRevision) return C.fail('工作区已在其他页面更新，请刷新或另存副本', 'conflict');
        const record = C.clone(next); record.revision = expectedRevision + 1; record.commitId = uid();
        const dbWrite = dbResult.ok ? await records.compareAndPut(record, selection.value.dbRevision, extras) : dbResult;
        if (!dbWrite.ok && dbWrite.error?.code === 'conflict') return dbWrite;
        // A local-only commit requires a cross-tab lock; otherwise refuse unsafe fallback writes.
        const localWrite = dbWrite.ok || environment.navigator?.locks?.request ? localCommit(record, extras) : C.fail('无法安全保存：数据库与浏览器锁不可用，请导出备份', 'unavailable');
        if (!dbWrite.ok && !localWrite.ok) return C.fail('浏览器保存失败，请导出备份；' + (localWrite.error?.message || dbWrite.error?.message), 'unavailable');
        current = record;
        extras.forEach(item => { points = points.filter(point => point.id !== item.id); points.push(C.clone(item)); });
        return C.ok(C.clone(record));
      };
      try {
        return environment.navigator?.locks?.request ? await environment.navigator.locks.request('electrical-workspace-write-v1', operation) : await operation();
      } catch (error) { return C.fail(error.message, 'unavailable'); }
    }
    function commit(next, revision, extras = []) {
      const detached = C.clone(next), detachedExtras = C.clone(extras);
      const result = queue.then(() => persist(detached, revision, detachedExtras));
      queue = result.catch(() => {}); return result;
    }
    async function createRecoveryPoint(scope) {
      await ready;
      if (blocked) return blocked;
      const point = { id: 'recovery-' + uid(), kind: 'recovery-point', createdAt: new Date().toISOString(), scope: C.clone(scope), state: C.clone(current) };
      const dbWrite = await records.put(point);
      const localWrite = storage.writeJson(PREFIX + 'point:' + point.id, point);
      if (!dbWrite.ok && !localWrite.ok) return C.fail('恢复点保存失败，请先导出备份', 'unavailable');
      const checked = await readRecoveryPoint(point.id);
      if (!checked.ok || JSON.stringify(checked.value) !== JSON.stringify(point)) return C.fail('恢复点读回校验失败');
      points.push(C.clone(point));
      return C.ok({ id: point.id });
    }
    async function readRecoveryPoint(id) {
      await ready;
      const all = await records.getAll();
      const point = (all.ok ? all.value : []).find(item => item.id === id && item.kind === 'recovery-point') || storage.readJson(PREFIX + 'point:' + id).value;
      if (!point || !C.validateWorkspace(point.state).ok) return C.fail('恢复点不存在或已损坏');
      return C.ok(C.clone(point));
    }
    async function listRecoveryPoints() {
      await ready;
      const keys = storage.keys(PREFIX + 'point:');
      const local = keys.ok ? keys.value.map(key => storage.readJson(key).value).filter(Boolean) : [];
      return [...new Map([...points, ...local].map(point => [point.id, point])).values()].map(({ id, createdAt, scope }) => ({ id, createdAt, scope }));
    }
    return { ready, read: () => C.clone(current), commit, createRecoveryPoint, listRecoveryPoints, readRecoveryPoint, conflicts: () => C.clone(conflicts) };
  }
  return Object.freeze({ createWorkspaceStore, PREFIX });
});
