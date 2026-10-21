/* Project lifecycle: save before navigation; never let an old editor own a new project. */
(function () {
  'use strict';
  const C = window.ElectricalWorkspaceCore, A = window.ElectricalProjectAdapters;
  let workspace = C.createWorkspace(), store, current = null, initialized, enabled = false;
  let queue = Promise.resolve(), timer, observer, detach = () => {}, generation = 0, lastSaved = '', pendingFailure = null, navigationRequested = false, editRevision = 0;
  const uid = () => crypto.randomUUID?.() || 'project-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  const now = () => new Date().toISOString();
  const enqueue = (fn, freeze = false) => { const result = queue.then(async () => { if (freeze && current) current.frame.host.inert = true; try { return await fn(); } finally { if (freeze && current) current.frame.host.inert = false; } }).catch(error => { message('操作失败：' + error.message); return C.fail(error.message); }); queue = result.then(() => {}); return result; };
  function message(text) { if (current?.frame.status) current.frame.status.textContent = text + (currentProject()?.requiresReview ? ' · 备份来源版本不同，需要重新校核' : ''); }
  function captureShared() {
    const materials = window.ElectricalToolkit.get('materials');
    return { ...workspace.shared, materials: materials?.captureShared ? materials.captureShared() : workspace.shared.materials,
      preferences: { ...workspace.shared.preferences, activeModule: current?.moduleId || workspace.shared.preferences?.activeModule || '' } };
  }
  async function initialize() {
    if (initialized) return initialized;
    initialized = (async () => {
      await window.CalculatorDrafts.ready;
      window.ElectricalToolkit.list().forEach(calc => A.ensure(calc));
      store = window.ElectricalWorkspaceStore.createWorkspaceStore(window);
      const loaded = await store.ready; workspace = store.read();
      if (!loaded.ok) { pendingFailure = loaded; workspace.preserved.push(...store.conflicts().map(value => ({ moduleId: '', source: 'workspace-conflict', value, reason: loaded.error.message }))); }
      else {
        const old = A.collectLegacy(window.ElectricalStorage, window.CalculatorDrafts);
        const migrated = A.migrateLegacy({ workspace, ...old });
        if (!migrated.ok) pendingFailure = migrated;
        else {
          const next = migrated.value;
          if (!workspace.migrations.preserved) { next.preserved.push(...old.preserved); next.migrations.preserved = 1; }
          if (JSON.stringify(next) !== JSON.stringify(workspace)) {
            const saved = await store.commit(next, workspace.revision);
            workspace = saved.ok ? saved.value : next;
            if (!saved.ok) pendingFailure = saved;
          }
        }
      }
      const materials = window.ElectricalToolkit.get('materials');
      if (workspace.shared.materials && materials?.restoreShared) materials.restoreShared(workspace.shared.materials);
      enabled = true;
      return loaded;
    })().catch(error => { pendingFailure = C.fail(error.message); enabled = true; return pendingFailure; });
    return initialized;
  }
  async function commit(next) {
    const result = await store.commit(next, workspace.revision);
    if (result.ok) { workspace = result.value; pendingFailure = null; }
    else pendingFailure = result;
    return result;
  }
  function readDraft(moduleId) {
    if (A.get(moduleId)?.mode === 'query') return C.clone(workspace.queries[moduleId] || null);
    const project = workspace.projects.find(item => item.moduleId === moduleId && item.id === workspace.active[moduleId]);
    return project ? C.clone(project.payload) : null;
  }
  function currentProject() { return workspace.projects.find(item => item.id === current?.projectId) || null; }
  function projects() { return workspace.projects.filter(item => item.moduleId === current?.moduleId).map(C.clone); }
  function refreshToolbar() { if (current) window.ElectricalProjectUI.mountProjectToolbar(current.frame.toolbar, api); }
  function schedule() { editRevision += 1; clearTimeout(timer); message('未保存 · 正在等待自动保存'); timer = setTimeout(() => api.flush(), 180); }
  function bind() {
    const host = current.frame.host;
    ['input', 'change', 'click', 'paste'].forEach(type => host.addEventListener(type, schedule, true));
    observer = new MutationObserver(schedule); observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'src'] });
    detach = () => { clearTimeout(timer); observer.disconnect(); ['input', 'change', 'click', 'paste'].forEach(type => host.removeEventListener(type, schedule, true)); };
  }
  function mount(moduleId, payload, projectId, frozen = false) {
    detach(); detach = () => {};
    document.getElementById('engineering-image-preview')?.remove();
    const calc = window.ElectricalToolkit.get(moduleId), adapter = A.get(moduleId);
    const token = ++generation;
    const frame = window.ElectricalProjectUI.createFrame(calc, adapter.mode === 'project', api);
    current = { moduleId, projectId, token, calc, adapter, frame };
    frame.host.inert = frozen;
    adapter.initialize(frame.host);
    if (payload) adapter.restore(C.clone(payload), frame.host);
    window.ElectricalToolkit.activate(moduleId);
    lastSaved = payload ? JSON.stringify(adapter.capture(frame.host)) : '';
    refreshToolbar(); bind();
    message(pendingFailure ? '浏览器保存失败：' + pendingFailure.error.message : '已保存至当前浏览器 · 可切换项目继续编辑');
  }
  async function flushInternal() {
    clearTimeout(timer);
    if (!current) return C.ok(null);
    let payload;
    try { payload = current.adapter.capture(current.frame.host); }
    catch (error) { message('草稿保存失败：' + error.message); return C.fail(error.message); }
    const checked = current.adapter.validate(payload);
    if (!checked.ok) { message('草稿保存失败：' + checked.error.message); return checked; }
    const shared = captureShared(), json = JSON.stringify(payload);
    if (!pendingFailure && json === lastSaved && JSON.stringify(shared) === JSON.stringify(workspace.shared)) {
      message('已保存至当前浏览器 · 当前项目可继续编辑'); return C.ok(currentProject());
    }
    let next = C.clone(workspace);
    if (current.adapter.mode === 'query') next.queries[current.moduleId] = checked.value;
    else {
      const project = currentProject();
      const update = C.updateProject(next, project.id, checked.value, project.revision, now());
      if (!update.ok) return update;
      next = update.value;
    }
    next.shared = shared;
    message('正在保存…');
    const saved = await commit(next);
    if (!saved.ok) { message('浏览器保存失败，请导出备份：' + saved.error.message); return saved; }
    lastSaved = json; refreshToolbar();
    const stillSame = JSON.stringify(current.adapter.capture(current.frame.host)) === json;
    message(stillSame ? '已保存至当前浏览器 · 切换项目或重新打开可继续编辑' : '未保存 · 保存期间有新修改');
    if (!stillSame) schedule();
    return C.ok(currentProject());
  }
  async function transition(moduleId, projectId) {
    await initialize();
    if (!window.ElectricalToolkit.get(moduleId)) return C.fail('未知功能');
    const source = current ? { moduleId: current.moduleId, projectId: current.projectId, payload: current.adapter.capture(current.frame.host) } : null;
    if (current) current.frame.host.inert = true;
    try {
      const saved = await flushInternal(); if (!saved.ok) return saved;
      const adapter = A.get(moduleId);
      let next = C.clone(workspace), payload, initializedDefault = false;
      if (adapter.mode === 'project') {
        projectId = projectId || next.active[moduleId];
        let target = next.projects.find(item => item.moduleId === moduleId && item.id === projectId);
        if (!target && projectId) return C.fail('目标项目不存在');
        if (!target) {
          mount(moduleId, null, null, true);
          payload = current.adapter.capture(current.frame.host);
          const checked = adapter.validate(payload); if (!checked.ok) throw new Error(checked.error.message);
          const created = C.createProject(next, { moduleId, name: '新项目 1', payload, appVersion: '2.1.1', adapterVersion: adapter.version }, { id: uid(), now: now() });
          if (!created.ok) throw new Error(created.error.message);
          next = created.value; projectId = next.active[moduleId];
          initializedDefault = true;
        } else {
          const checked = adapter.validate(target.payload); if (!checked.ok) return checked;
          payload = checked.value;
        }
        next.active[moduleId] = projectId;
      } else payload = next.queries[moduleId] || null;
      next.shared = captureShared(); next.shared.preferences.activeModule = moduleId;
      // Restore before committing an active pointer; failed target rendering leaves source durable.
      if (initializedDefault) current.projectId = projectId;
      else mount(moduleId, payload, projectId || null, true);
      const mountedPayload = JSON.stringify(current.adapter.capture(current.frame.host));
      if (adapter.mode === 'query') next.queries[moduleId] = adapter.capture(current.frame.host);
      const changed = JSON.stringify(next) !== JSON.stringify(workspace);
      if (changed) { const written = await commit(next); if (!written.ok) { if (!source) workspace = next; throw new Error(written.error.message); } }
      refreshToolbar();
      lastSaved = mountedPayload;
      if (JSON.stringify(current.adapter.capture(current.frame.host)) !== lastSaved) return await flushInternal();
      message('已保存至当前浏览器 · 当前项目可继续编辑');
      return C.ok(null);
    } catch (error) {
      if (source) {
        try { mount(source.moduleId, source.payload, source.projectId); }
        catch (restoreError) { message('恢复原项目失败，请立即导出备份：' + restoreError.message); }
      }
      message('项目切换失败：' + error.message); return C.fail(error.message);
    } finally { if (current) current.frame.host.inert = false; }
  }
  async function create(name, copy) {
    const saved = await flushInternal(); if (!saved.ok) return saved;
    if (!C.nameValid(name) || !currentProject()) return C.fail('项目名称无效');
    const source = { moduleId: current.moduleId, projectId: current.projectId, payload: current.adapter.capture(current.frame.host) };
    try {
      if (!copy) mount(source.moduleId, null, null, true);
      const payload = copy ? source.payload : current.adapter.capture(current.frame.host);
      const savedPayload = JSON.stringify(payload);
      const next = C.createProject(workspace, { moduleId: source.moduleId, name, payload, appVersion: '2.1.1', adapterVersion: current.adapter.version }, { id: uid(), now: now() });
      if (!next.ok) throw new Error(next.error.message);
      const written = await commit(next.value); if (!written.ok) throw new Error(written.error.message);
      if (copy) mount(source.moduleId, payload, workspace.active[source.moduleId]);
      else { current.projectId = workspace.active[source.moduleId]; refreshToolbar(); lastSaved = savedPayload; if (JSON.stringify(current.adapter.capture(current.frame.host)) !== lastSaved) await flushInternal(); message('已保存至当前浏览器 · 新项目已初始化'); }
      return C.ok(currentProject());
    } catch (error) { mount(source.moduleId, source.payload, source.projectId); message('新建失败：' + error.message); return C.fail(error.message); }
    finally { if (current) current.frame.host.inert = false; }
  }
  async function captureWorkspace() {
    await initialize();
    const flushed = await api.flush();
    const copy = C.clone(workspace);
    if (current) {
      const payload = current.adapter.capture(current.frame.host), checked = current.adapter.validate(payload);
      if (!checked.ok) return checked;
      if (current.adapter.mode === 'query') copy.queries[current.moduleId] = payload;
      else { const target = copy.projects.find(item => item.id === current.projectId); if (target) target.payload = payload; }
    }
    copy.shared = captureShared();
    return C.ok({ formatVersion: 1, id: uid(), createdAt: now(), appVersion: '2.1.1', workspaceRevision: workspace.revision, projects: copy.projects, queries: copy.queries, shared: copy.shared, preserved: copy.preserved, browserUnsaved: !flushed.ok });
  }
  async function applyRestore(inspection, options = {}) {
    const repairing = store.blocked();
    if (repairing && !options.repairConfirmed) return C.fail('浏览器工作区损坏或冲突，需要明确确认保留原始数据并从备份重建');
    if (!repairing) { const flushed = await flushInternal(); if (!flushed.ok) return flushed; }
    const restoreBase = repairing ? { ...C.createWorkspace(), preserved: C.clone(workspace.preserved) } : workspace;
    const planned = C.planRestore(restoreBase, inspection, options, { id: uid, now });
    if (!planned.ok) return planned;
    for (const project of planned.value.next.projects.filter(project => planned.value.affected.projectIds.includes(project.id))) {
      const checked = A.get(project.moduleId)?.validate(project.payload);
      if (!checked?.ok) return checked || C.fail('恢复项目功能不支持');
    }
    if (options.includeShared && planned.value.next.shared.materials) {
      const checked = window.ElectricalToolkit.get('materials').validateShared(planned.value.next.shared.materials);
      if (!checked.ok) return checked;
    }
    const source = current && { moduleId: current.moduleId, projectId: current.projectId };
    const written = repairing ? await store.repair(planned.value.next, true) : await store.restore(planned.value, workspace.revision);
    if (!written.ok) { message('恢复失败：' + written.error.message); return written; }
    workspace = repairing ? written.value : written.value.state; pendingFailure = null;
    try {
      if (workspace.shared.materials) window.ElectricalToolkit.get('materials').restoreShared(workspace.shared.materials);
      if (source && (A.get(source.moduleId)?.mode === 'query' || workspace.active[source.moduleId])) mount(source.moduleId, readDraft(source.moduleId), workspace.active[source.moduleId] || null);
      else if (workspace.projects.length) { const target = workspace.projects[0]; mount(target.moduleId, target.payload, target.id); }
      else mount('materials', readDraft('materials'), null);
    } catch (error) {
      const reverted = !repairing && await store.rollback(written.value.recoveryPointId, workspace.revision);
      if (reverted?.ok) { workspace = reverted.value; if (workspace.shared.materials) window.ElectricalToolkit.get('materials').restoreShared(workspace.shared.materials); if (source) mount(source.moduleId, readDraft(source.moduleId), workspace.active[source.moduleId] || null); }
      return C.fail('恢复后的页面加载失败：' + error.message + (reverted?.ok ? '；已自动回退原工作区。' : '；数据已保存，请保留备份并检查恢复点，勿继续覆盖。'));
    }
    return written;
  }
  async function rollback(pointId) {
    const flushed = await flushInternal(); if (!flushed.ok) return flushed;
    const source = current && { moduleId: current.moduleId };
    const written = await store.rollback(pointId, workspace.revision);
    if (!written.ok) return written;
    workspace = written.value;
    if (workspace.shared.materials) window.ElectricalToolkit.get('materials').restoreShared(workspace.shared.materials);
    if (source) mount(source.moduleId, readDraft(source.moduleId), workspace.active[source.moduleId] || null);
    return written;
  }
  const api = {
    get enabled() { return enabled; }, initialize, readDraft, currentProject, projects, refreshToolbar, message,
    get store() { return store; }, workspace: () => C.clone(workspace),
    editRevision: () => editRevision,
    session: () => current ? { moduleId: current.moduleId, projectId: current.projectId, token: current.token } : null,
    isCurrent: token => current?.token === token,
    open: (id, projectId) => { navigationRequested = true; return enqueue(() => transition(id, projectId)); },
    openInitial: id => navigationRequested ? Promise.resolve(C.ok(null)) : enqueue(() => transition(id)),
    flush: () => enqueue(flushInternal),
    newProject: name => enqueue(() => create(name, false), true), copyProject: name => enqueue(() => create(name, true), true),
    renameProject: name => enqueue(async () => { const saved = await flushInternal(); if (!saved.ok) return saved; const renamed = C.renameProject(workspace, current.projectId, name, now()); if (!renamed.ok) return renamed; const result = await commit(renamed.value); refreshToolbar(); return result; }),
    deleteProject: id => enqueue(async () => { const saved = await flushInternal(); if (!saved.ok) return saved; const removed = C.removeProject(workspace, id); if (!removed.ok) return removed; const result = await commit(removed.value); if (result.ok) mount(current.moduleId, readDraft(current.moduleId), workspace.active[current.moduleId]); return result; }, true),
    reset: () => enqueue(async () => { const saved = await flushInternal(); if (!saved.ok) return saved; const source = { ...current, payload: current.adapter.capture(current.frame.host) }; try { mount(source.moduleId, null, source.projectId); lastSaved = ''; return await flushInternal(); } catch (error) { mount(source.moduleId, source.payload, source.projectId); return C.fail(error.message); } }),
    captureWorkspace,
    applyRestore: (inspection, options) => enqueue(() => applyRestore(inspection, options), true),
    rollback: id => enqueue(() => rollback(id), true),
  };
  window.ElectricalProjectController = api;
})();
