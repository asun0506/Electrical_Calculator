/* Adapter registry and non-destructive migration. No DOM work during migration. */
(function (factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./workspace-core.js'));
  else window.ElectricalProjectAdapters = factory(window.ElectricalWorkspaceCore);
})(function (C) {
  'use strict';
  const registry = new Map();
  const QUERY_IDS = ['materials', 'engineering-formulas', 'standards-library'];
  const LEGACY_KEYS = ['electrical_toolkit_part_estimator_v1', 'electrical_toolkit_iec60664_verification_v1', 'matdb_override', 'matdb_custom', 'electrical_toolkit_active_calculator_v1'];
  function register(id, adapter) {
    if (!C.idValid(id) || !adapter || typeof adapter.validate !== 'function') throw new Error('无效项目适配器');
    registry.set(id, adapter); return adapter;
  }
  function ensure(calc) {
    if (registry.has(calc.id)) return registry.get(calc.id);
    return register(calc.id, {
      version: 1, mode: QUERY_IDS.includes(calc.id) ? 'query' : 'project',
      initialize(host) { calc.render(host); if (calc.resetDraft && !QUERY_IDS.includes(calc.id)) calc.resetDraft(host); },
      validate: payload => C.validatePayload(payload),
      capture: host => window.CalculatorDrafts.capture(calc, host),
      restore: (payload, host) => window.CalculatorDrafts.restore(calc, host, payload),
    });
  }
  function migrateLegacy({ workspace, legacyDrafts = {}, legacyValues = {}, adapters = registry }) {
    const valid = C.validateWorkspace(workspace);
    if (!valid.ok) return valid;
    let next = valid.value;
    const preserve = (moduleId, source, value, reason) => next.preserved.push({ moduleId, source, value: C.clone(value), reason });
    for (const [id, adapter] of adapters.entries()) {
      if (next.migrations[id]) continue;
      const candidates = [];
      if (legacyDrafts[id]) candidates.push({ source: 'draft:' + id, payload: legacyDrafts[id], name: '原有项目' });
      if (id === 'busbar-temp' && !legacyDrafts[id] && legacyDrafts['rms-current']) {
        const row = legacyDrafts['rms-current'].form?.find(item => item.id === 'rc-ta');
        if (row) candidates.push({ source: 'draft:rms-current', name: '原有RMS项目', payload: { form: [{ ...row, id: 'bb-ta', index: 0 }], model: null, tabs: [], details: [] } });
      }
      const singletonKey = id === 'part-estimator' ? LEGACY_KEYS[0] : id === 'iec60664' ? LEGACY_KEYS[1] : null;
      const singleton = singletonKey && legacyValues[singletonKey];
      if (singleton) {
        const model = id === 'part-estimator' ? { project: singleton, activeId: singleton.parts?.[0]?.id || '' } : singleton;
        if (!candidates.some(item => JSON.stringify(item.payload.model) === JSON.stringify(model))) candidates.push({ source: singletonKey, name: candidates.length ? '历史项目' : '原有项目', payload: { form: [], model, tabs: [], details: [] } });
      }
      candidates.forEach((candidate, index) => {
        const model = candidate.payload.model;
        const obsoleteBolt = id === 'bolt' && model && (model.schemaVersion !== 3 || model.parts?.some(part => part.joints?.some(joint => joint.calculationModel && joint.calculationModel !== 'workbook-v3')));
        let checked;
        try { checked = obsoleteBolt ? C.fail('旧 K 算法不迁移') : adapter.validate(candidate.payload); }
        catch (error) { checked = C.fail(error.message); }
        if (!checked.ok) { preserve(id, candidate.source, candidate.payload, checked.error.message); return; }
        if (adapter.mode === 'query') { next.queries[id] = C.clone(checked.value); return; }
        let projectId = 'legacy-' + id + '-' + index;
        while (next.projects.some(project => project.id === projectId)) projectId += '-copy';
        const created = C.createProject(next, { moduleId: id, name: candidate.name, payload: checked.value, appVersion: '2.1.1', adapterVersion: adapter.version || 1 }, { id: projectId, now: new Date().toISOString() });
        if (created.ok) next = created.value;
        else preserve(id, candidate.source, candidate.payload, created.error.message);
      });
      next.migrations[id] = 1;
    }
    if (!next.migrations.shared) {
      next.shared.materials = { overrides: C.clone(legacyValues.matdb_override || {}), customs: C.clone(legacyValues.matdb_custom || {}) };
      next.shared.preferences = { activeModule: typeof legacyValues.electrical_toolkit_active_calculator_v1 === 'string' ? legacyValues.electrical_toolkit_active_calculator_v1 : '' };
      next.migrations.shared = 1;
    }
    return C.validateWorkspace(next);
  }
  function collectLegacy(storage, drafts) {
    const legacyValues = {}, legacyDrafts = {}, preserved = [];
    const ids = [...registry.keys(), 'rms-current'];
    ids.forEach(id => { const value = drafts.readLegacy ? drafts.readLegacy(id) : drafts.read(id); if (value) legacyDrafts[id] = value; });
    LEGACY_KEYS.forEach(key => {
      const result = storage.readText(key);
      if (!result.ok) throw new Error('旧数据读取失败：' + key + '；' + result.error.message);
      if (result.value == null) return;
      if (key === 'electrical_toolkit_active_calculator_v1') { legacyValues[key] = result.value; return; }
      try {
        const value = JSON.parse(result.value);
        if (!C.validJSON(value) || value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('旧数据格式无效');
        legacyValues[key] = value;
      } catch (error) { preserved.push({ moduleId: '', source: key, value: result.value, reason: error.message }); }
    });
    for (const item of drafts.preserved?.() || []) preserved.push(item);
    return { legacyValues, legacyDrafts, preserved };
  }
  return { register, ensure, get: id => registry.get(id), entries: () => registry.entries(), list: () => [...registry.entries()], QUERY_IDS, LEGACY_KEYS, migrateLegacy, collectLegacy };
});
