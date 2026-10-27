/* Pure per-module projects. Business schemas remain owned by calculators. */
(function (factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.ElectricalWorkspaceCore = api;
})(function () {
  'use strict';
  const ok = value => ({ ok: true, value });
  const fail = (message, code = 'invalid') => ({ ok: false, error: { code, message } });
  const clone = value => JSON.parse(JSON.stringify(value));
  const idValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const nameValid = value => typeof value === 'string' && !!value.trim() && [...value.trim()].length <= 120;
  const dateValid = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  function validJSON(value, depth = 0) {
    if (depth > 40) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (!Array.isArray(value) && !plain(value)) return false;
    return Object.keys(value).every(key => !['__proto__', 'prototype', 'constructor'].includes(key) && validJSON(value[key], depth + 1));
  }
  function validatePayload(value) {
    if (!plain(value) || !validJSON(value) || !Array.isArray(value.form) || !Array.isArray(value.tabs) || !Array.isArray(value.details)) return fail('项目快照结构无效');
    if (!value.form.every(item => plain(item) && typeof item.id === 'string' && Number.isInteger(item.index) && item.index >= 0 && typeof item.value === 'string' && (item.checked === undefined || typeof item.checked === 'boolean'))) return fail('项目表单无效');
    if (!value.tabs.every(plain) || !value.details.every(item => plain(item) && typeof item.id === 'string' && Number.isInteger(item.index) && item.index >= 0 && typeof item.open === 'boolean')) return fail('项目界面状态无效');
    return ok(clone(value));
  }
  function validateProject(project) {
    return plain(project) && idValid(project.id) && idValid(project.moduleId) && nameValid(project.name) && dateValid(project.createdAt) && dateValid(project.updatedAt)
      && Number.isSafeInteger(project.revision) && project.revision >= 1 && typeof project.appVersion === 'string'
      && Number.isInteger(project.adapterVersion) && project.adapterVersion >= 1 && validatePayload(project.payload).ok;
  }
  function createWorkspace() {
    return { schemaVersion: 1, id: 'workspace', revision: 0, commitId: '', projects: [], active: {}, queries: {}, shared: {}, preserved: [], migrations: {} };
  }
  function validateWorkspace(value) {
    if (!plain(value) || !validJSON(value) || value.schemaVersion !== 1 || value.id !== 'workspace' || !Number.isSafeInteger(value.revision) || value.revision < 0 || typeof value.commitId !== 'string'
      || !Array.isArray(value.projects) || !value.projects.every(validateProject) || new Set(value.projects.map(item => item.id)).size !== value.projects.length
      || !plain(value.active) || !plain(value.queries) || !plain(value.shared) || !Array.isArray(value.preserved) || !plain(value.migrations)) return fail('工作区数据无效或版本不支持');
    if (!Object.entries(value.active).every(([moduleId, id]) => idValid(moduleId) && value.projects.some(item => item.id === id && item.moduleId === moduleId))) return fail('活动项目引用无效');
    if (!Object.entries(value.queries).every(([id, payload]) => idValid(id) && validatePayload(payload).ok)) return fail('查询草稿无效');
    return ok(clone(value));
  }
  function createProject(state, fields, { id, now } = {}) {
    if (!validateWorkspace(state).ok || !idValid(id) || state.projects.some(item => item.id === id) || !idValid(fields.moduleId) || !nameValid(fields.name) || !dateValid(now) || !validatePayload(fields.payload).ok) return fail('项目名称、身份或内容无效');
    const next = clone(state);
    next.projects.push({ id, moduleId: fields.moduleId, name: fields.name.trim(), createdAt: now, updatedAt: now, revision: 1, appVersion: fields.appVersion || '2.1.1', adapterVersion: fields.adapterVersion || 1, payload: clone(fields.payload) });
    next.active[fields.moduleId] = id;
    return ok(next);
  }
  function updateProject(state, id, payload, expectedRevision, now) {
    const original = state.projects.find(item => item.id === id);
    if (!original || !validatePayload(payload).ok || !dateValid(now)) return fail('项目或快照无效');
    if (original.revision !== expectedRevision) return fail('项目已被其他页面修改，请刷新或另存副本', 'conflict');
    const next = clone(state), item = next.projects.find(item => item.id === id);
    item.payload = clone(payload); item.revision += 1; item.updatedAt = now;
    return ok(next);
  }
  function renameProject(state, id, name, now) {
    if (!nameValid(name) || !dateValid(now) || !state.projects.some(item => item.id === id)) return fail('项目名称无效');
    const next = clone(state), item = next.projects.find(item => item.id === id);
    item.name = name.trim(); item.updatedAt = now; item.revision += 1;
    return ok(next);
  }
  function removeProject(state, id) {
    const item = state.projects.find(item => item.id === id);
    if (!item || state.projects.filter(other => other.moduleId === item.moduleId).length <= 1) return fail('每个功能至少保留一个项目');
    const next = clone(state); next.projects = next.projects.filter(other => other.id !== id);
    if (next.active[item.moduleId] === id) next.active[item.moduleId] = next.projects.find(other => other.moduleId === item.moduleId).id;
    return ok(next);
  }
  function planRestore(state, inspection, options = {}, clock = {}) {
    try {
      if (!validateWorkspace(state).ok || !inspection || !Array.isArray(inspection.validProjects)) throw new Error('恢复来源或工作区无效');
      const mode = options.mode || 'copy';
      if (!['copy', 'replace'].includes(mode)) throw new Error('恢复方式无效');
      const selected = options.projectIds || inspection.validProjects.map(project => project.id);
      if (!Array.isArray(selected) || new Set(selected).size !== selected.length) throw new Error('恢复项目选择无效');
      let next = clone(state);
      const affected = { projectIds: [], createdIds: [], sharedKeys: [], queryIds: [] }, usedTargets = new Set();
      for (const sourceId of selected) {
        const source = inspection.validProjects.find(project => project.id === sourceId);
        if (!source || !validateProject(source)) throw new Error('选择包含损坏或不存在的项目');
        const now = clock.now ? clock.now() : new Date().toISOString();
        const review = source.appVersion !== (options.currentAppVersion || '2.1.1');
        const origin = { id: source.id, appVersion: source.appVersion, adapterVersion: source.adapterVersion, snapshotId: inspection.manifest?.snapshot?.id || '' };
        if (mode === 'copy') {
          const id = clock.id ? clock.id() : globalThis.crypto?.randomUUID?.();
          const name = [...source.name].slice(0, 110).join('') + '（恢复副本）';
          const created = createProject(next, { ...source, name, payload: source.payload }, { id, now });
          if (!created.ok) throw new Error(created.error.message);
          next = created.value;
          const project = next.projects.find(project => project.id === id);
          project.restoredFrom = origin; project.requiresReview = review;
          affected.projectIds.push(id); affected.createdIds.push(id);
        } else {
          const targetId = options.targets?.[sourceId], target = next.projects.find(project => project.id === targetId);
          if (!target || target.moduleId !== source.moduleId || usedTargets.has(targetId)) throw new Error('请为每个项目明确选择同功能且不重复的替换目标');
          usedTargets.add(targetId);
          const updated = updateProject(next, targetId, source.payload, target.revision, now);
          if (!updated.ok) throw new Error(updated.error.message);
          next = updated.value;
          const project = next.projects.find(project => project.id === targetId);
          project.restoredFrom = origin; project.requiresReview = review;
          project.adapterVersion = source.adapterVersion; project.appVersion = source.appVersion;
          affected.projectIds.push(targetId);
        }
      }
      // Restoring copies does not silently switch an existing active project.
      for (const [moduleId, id] of Object.entries(state.active)) next.active[moduleId] = id;
      if (options.includeShared) {
        for (const [kind, value] of Object.entries(inspection.shared || {})) { next.shared[kind] = clone(value); affected.sharedKeys.push(kind); }
        for (const [id, value] of Object.entries(inspection.queries || {})) { if (!validatePayload(value).ok) throw new Error('查询快照无效'); next.queries[id] = clone(value); affected.queryIds.push(id); }
        if (Array.isArray(inspection.preserved)) next.preserved.push(...clone(inspection.preserved));
      }
      if (!selected.length && !affected.sharedKeys.length && !affected.queryIds.length) throw new Error('请至少选择一个有效项目或公共数据');
      if (!validateWorkspace(next).ok) throw new Error('恢复后的工作区无效');
      return ok({ next, affected });
    } catch (error) { return fail(error.message, 'restore'); }
  }
  return Object.freeze({ ok, fail, clone, idValid, nameValid, dateValid, validJSON, validatePayload, validateProject, validateWorkspace, createWorkspace, createProject, updateProject, renameProject, removeProject, planRestore });
});
