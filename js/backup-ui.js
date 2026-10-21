/* Backup management is global infrastructure, not a top-level business project. */
(function () {
  'use strict';
  const C = window.ElectricalWorkspaceCore, esc = value => window.ElectricalSafety.escapeHtml(value);
  const META_KEY = 'electrical_workspace_backup_status_v1';
  let controller, store, format, io, adapters, dialog = null, message = '', operation = null, inspection = null;
  let lastBackup = window.ElectricalStorage.readJson(META_KEY).value || null;
  let transferModule = null;
  function setMessage(text) { message = text; const node = dialog?.querySelector('[data-backup-state]'); if (node) node.textContent = text; }
  function refreshState() {
    if (!dialog) return;
    const directory = io.directoryStatus();
    dialog.querySelector('[data-backup-directory]').textContent = directory.name ? '备份目录：' + directory.name + '（' + directory.permission + '）' : '尚未选择备份目录；也可以直接下载 ZIP。';
    dialog.querySelector('[data-backup-last]').textContent = lastBackup ? '最近已验证目录备份：' + lastBackup.createdAt.replace('T', ' ').slice(0, 19) + '，工作区版本 ' + lastBackup.revision : '尚未完成本地目录备份';
    if (message) setMessage(message);
    else setMessage(lastBackup ? (lastBackup.revision === controller.workspace().revision && lastBackup.editRevision === controller.editRevision() ? '当前工作区已有目录备份' : '有工作内容尚未备份') : '工作内容尚未备份');
  }
  function close() { if (dialog?.open) dialog.close(); }
  function show() {
    if (dialog?.open) { refreshState(); return; }
    const trigger = document.activeElement;
    dialog = document.createElement('dialog'); dialog.className = 'workspace-dialog backup-dialog';
    dialog.innerHTML = `<h2>备份与恢复</h2><p class="backup-lead">浏览器用于日常续做，本地快照用于备份。不会自动覆盖或删除历史备份。</p><p data-backup-directory></p><p data-backup-last></p><p data-backup-state role="status" aria-live="polite"></p><div class="backup-actions"><button type="button" data-backup-action="choose">选择 / 更换目录</button><button type="button" class="btn btn-primary" data-backup-action="directory">立即备份全部到目录</button><button type="button" data-backup-action="zip">下载全部 ZIP 备份</button></div><hr><h3>检查与恢复</h3><p>选择一个完整的时间快照目录，或导入备份 ZIP。检查通过前不会修改当前工作内容。</p><div class="backup-actions"><button type="button" data-backup-action="read-directory">检查快照目录</button><label class="backup-file-label">检查备份 ZIP<input type="file" accept=".zip,application/zip" data-backup-import></label></div><section data-backup-preview></section><section data-recovery-points></section><p class="backup-footnote">不含程序代码、未导入浏览器的磁盘文件或已下载的 PDF/Excel。恢复数据不能修复程序算法错误。</p><div class="workspace-dialog-actions"><button type="button" data-backup-cancel>取消当前备份</button><button type="button" data-close-backups>关闭</button></div>`;
    dialog.querySelector('[data-close-backups]').onclick = close;
    dialog.querySelector('[data-backup-cancel]').onclick = () => { operation?.abort(); setMessage(operation ? '正在取消本次备份，旧备份不受影响' : '当前没有正在执行的备份'); };
    dialog.querySelectorAll('[data-backup-action]').forEach(button => button.onclick = async () => {
      const action = button.dataset.backupAction;
      if (action === 'choose') { const chosen = await io.chooseDirectory(); setMessage(chosen.ok ? '已选择目录：' + chosen.value.name : chosen.error.message); refreshState(); }
      else if (action === 'read-directory') await inspectInput('directory');
      else await backupAll(action);
    });
    dialog.querySelector('[data-backup-import]').onchange = async event => { const file = event.target.files[0]; if (file) await inspectInput('zip', file); event.target.value = ''; };
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; transferModule = null; trigger?.focus(); }, { once: true });
    document.body.append(dialog); dialog.showModal(); refreshState();
    if (api.refreshRecoveryPoints) api.refreshRecoveryPoints();
  }
  function download(blob, name) {
    const link = document.createElement('a'), url = URL.createObjectURL(blob); link.href = url; link.download = window.ElectricalSafety.safeFilename(name);
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  async function backupAll(mode, { projectOnly = false } = {}) {
    if (operation) return C.fail('已有备份正在执行，请等待或取消');
    operation = new AbortController();
    try {
      setMessage('正在捕获全部工作内容…');
      const captured = await controller.captureWorkspace();
      if (!captured.ok) throw new Error(captured.error.message);
      const snapshot = captured.value, frozenEdit = controller.editRevision();
      if (projectOnly) {
        const current = controller.currentProject();
        if (!current) throw new Error('当前功能没有独立项目');
        snapshot.projects = snapshot.projects.filter(project => project.id === current.id);
        snapshot.queries = {}; snapshot.shared = {}; snapshot.preserved = [];
      }
      const modules = Object.fromEntries(window.ElectricalToolkit.list().map(calc => [calc.id, calc.title]));
      const packed = await format.pack(snapshot, { modules });
      if (!packed.ok) throw new Error(packed.error.message);
      if (operation.signal.aborted) throw new Error('本次备份已取消');
      if (mode === 'zip') {
        const generated = await io.createZip(packed.value.files);
        if (!generated.ok) throw new Error(generated.error.message);
        if (operation.signal.aborted) throw new Error('本次备份已取消');
        const prefix = projectOnly ? controller.currentProject().name + '__项目备份' : '电气计算器全部工作备份';
        download(generated.value, prefix + '__' + snapshot.createdAt.slice(0, 19).replace(/[:T]/g, '-') + '.zip');
        setMessage('备份包已生成，请确认文件已保存。' + (snapshot.browserUnsaved ? '注意：浏览器保存失败，包中已包含本次内存工作内容。' : ''));
      } else if (mode === 'directory') {
        const written = await io.writeDirectory(packed.value.files, snapshot.id, { signal: operation.signal, onProgress: ({ done, total }) => setMessage(`正在写入并校验 ${done} / ${total} 个文件…`) });
        if (!written.ok) throw new Error(written.error.message);
        const dirty = controller.editRevision() !== frozenEdit || controller.workspace().revision !== snapshot.workspaceRevision;
        lastBackup = { createdAt: new Date().toISOString(), revision: snapshot.workspaceRevision, editRevision: frozenEdit, directoryName: written.value.directoryName, browserUnsaved: snapshot.browserUnsaved };
        window.ElectricalStorage.writeJson(META_KEY, lastBackup);
        setMessage('目录备份已完成并通过读回校验：' + written.value.directoryName + (dirty ? '；仍有新修改未备份。' : '') + (snapshot.browserUnsaved ? '；浏览器保存失败，已保护本次内存内容。' : ''));
      } else throw new Error('未知备份方式');
      refreshState(); return C.ok({ snapshotId: snapshot.id });
    } catch (error) { setMessage('备份失败：' + error.message); return C.fail(error.message, 'backup'); }
    finally { operation = null; }
  }
  async function inspectInput(mode, file) {
    const read = mode === 'directory' ? await io.readDirectory() : await io.readZip(file);
    if (!read.ok) { setMessage('检查失败：' + read.error.message); return read; }
    const checked = await format.inspect(read.value, { adapters });
    if (!checked.ok) { setMessage('检查失败：' + checked.error.message); return checked; }
    inspection = checked.value;
    setMessage(`备份检查完成：${inspection.validProjects.length} 个有效项目，${inspection.invalidProjects.length} 个问题项目。尚未恢复任何内容。`);
    if (api.renderRestorePreview) api.renderRestorePreview(inspection);
    else if (dialog) dialog.querySelector('[data-backup-preview]').textContent = '可恢复项目：' + inspection.validProjects.map(project => project.name).join('、');
    return checked;
  }
  async function projectTransfer(action) {
    show();
    if (action === 'export') return backupAll('zip', { projectOnly: true });
    transferModule = controller.session()?.moduleId || null;
    dialog.querySelector('[data-backup-import]').click(); return C.ok(null);
  }
  function renderRestorePreview(value) {
    const host = dialog?.querySelector('[data-backup-preview]');
    if (!host) return;
    const current = controller.workspace();
    host.innerHTML = `<h3>恢复预览</h3><p>快照时间：${esc(value.manifest.snapshot.createdAt)}。默认新增副本，不覆盖已有工作。</p><label>恢复方式<select data-restore-mode><option value="copy">另存为副本（推荐）</option><option value="replace">替换明确指定的现有项目</option></select></label><div class="restore-project-list">${value.validProjects.map(project => {
      const allowed = !transferModule || transferModule === project.moduleId;
      return `<div class="restore-project-row"><label><input type="checkbox" data-restore-project value="${esc(project.id)}" ${allowed ? 'checked' : 'disabled'}><span>${esc(window.ElectricalToolkit.get(project.moduleId)?.title || project.moduleId)} / ${esc(project.name)}${allowed ? '' : '（不属于当前功能）'}</span></label><label data-target-label hidden>替换目标<select data-restore-target data-source-id="${esc(project.id)}"><option value="">请选择替换目标</option>${current.projects.filter(item => item.moduleId === project.moduleId).map(target => `<option value="${esc(target.id)}">${esc(target.name)} / ${esc(target.id.slice(-8))}</option>`).join('')}</select></label></div>`;
    }).join('')}</div>${value.invalidProjects.length ? `<div class="restore-warnings"><p>以下项目不能恢复：</p><ul>${value.invalidProjects.map(item => `<li>${esc(item.name || item.id)}：${esc(item.reason)}</li>`).join('')}</ul><label><input type="checkbox" data-restore-skip-invalid>我已了解问题，仅恢复已选择的有效项目</label></div>` : ''}<label class="restore-check"><input type="checkbox" data-restore-shared>同时恢复公共用户材料、查询状态和显示设置（默认不覆盖）</label><button type="button" class="btn btn-primary" data-restore-apply>恢复已选内容</button>`;
    host.querySelector('[data-restore-mode]').onchange = event => host.querySelectorAll('[data-target-label]').forEach(label => { label.hidden = event.target.value !== 'replace'; });
    host.querySelector('[data-restore-apply]').onclick = async event => {
      if (operation) { setMessage('备份仍在进行，请稍后恢复'); return; }
      if (value.invalidProjects.length && !host.querySelector('[data-restore-skip-invalid]').checked) { setMessage('请先确认已了解不能恢复的项目'); return; }
      const projectIds = [...host.querySelectorAll('[data-restore-project]:checked')].map(input => input.value), mode = host.querySelector('[data-restore-mode]').value;
      const includeShared = host.querySelector('[data-restore-shared]').checked;
      const targets = Object.fromEntries([...host.querySelectorAll('[data-restore-target]')].map(select => [select.dataset.sourceId, select.value]));
      const plan = C.planRestore(controller.workspace(), value, { projectIds, mode, includeShared, targets });
      if (!plan.ok) { setMessage('恢复未执行：' + plan.error.message); return; }
      if ((mode === 'replace' || includeShared) && !confirm('本次将替换你明确选定的项目或公共数据。系统会先持久化恢复点，其他未选项目不受影响。确定继续？')) return;
      const button = event.currentTarget; button.disabled = true;
      try {
        const result = await controller.applyRestore(value, { projectIds, mode, includeShared, targets });
        setMessage(result.ok ? '恢复已完成，输入已按当前算法重新计算。可以切换项目继续工作；恢复前的数据已保存在恢复点。' : '恢复失败，原工作内容保留：' + result.error.message);
        if (result.ok) await refreshRecoveryPoints();
      } finally { button.disabled = false; }
    };
  }
  async function refreshRecoveryPoints() {
    const host = dialog?.querySelector('[data-recovery-points]');
    if (!host) return;
    const points = (await store.listRecoveryPoints()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!host.isConnected) return;
    host.innerHTML = `<h3>恢复点</h3>${points.length ? points.map(point => `<div class="recovery-point-row"><span>${esc(point.createdAt.replace('T', ' ').slice(0, 19))}</span><button type="button" data-recovery-rollback="${esc(point.id)}">回退此次恢复</button><button type="button" data-recovery-copy="${esc(point.id)}">另存旧项目副本</button></div>`).join('') : '<p>尚无恢复点；每次恢复提交前会自动保留。</p>'}`;
    host.querySelectorAll('[data-recovery-rollback]').forEach(button => button.onclick = async () => {
      if (operation) { setMessage('请先等待当前备份完成'); return; }
      if (!confirm('回退此次恢复涉及的数据？若恢复后有新编辑，系统会阻止覆盖，其他项目保持不变。')) return;
      button.disabled = true;
      const result = await controller.rollback(button.dataset.recoveryRollback);
      setMessage(result.ok ? '已回退，原项目内容已恢复。' : '无法直接回退：' + result.error.message);
      await refreshRecoveryPoints();
    });
    host.querySelectorAll('[data-recovery-copy]').forEach(button => button.onclick = async () => {
      const loaded = await store.readRecoveryPoint(button.dataset.recoveryCopy);
      if (!loaded.ok) { setMessage(loaded.error.message); return; }
      const point = loaded.value, selected = point.state.projects.filter(project => point.scope.projectIds?.includes(project.id));
      const source = { manifest: { snapshot: { id: point.id } }, validProjects: selected, invalidProjects: [], queries: {}, shared: {}, preserved: [] };
      const result = await controller.applyRestore(source, { mode: 'copy' });
      setMessage(result.ok ? '恢复点中的旧项目已另存副本，现有工作未被覆盖。' : '另存失败：' + result.error.message);
      await refreshRecoveryPoints();
    });
  }
  function mount(options = {}) {
    controller = options.controller || window.ElectricalProjectController;
    store = options.store || controller.store; format = options.format || window.ElectricalBackupFormat;
    adapters = options.adapters || window.ElectricalProjectAdapters; io = options.io || io || window.ElectricalBackupIO.createBackupIO(window);
    let button = document.querySelector('[data-open-backups]');
    if (!button) {
      button = document.createElement('button'); button.type = 'button'; button.className = 'workspace-backup-entry'; button.dataset.openBackups = '';
      button.textContent = '备份与恢复'; button.addEventListener('click', () => { transferModule = null; show(); }); document.querySelector('.sidebar-footer').prepend(button);
    }
    return api;
  }
  const api = { mount, show, close, backupAll, inspectInput, projectTransfer, renderRestorePreview, refreshRecoveryPoints, getInspection: () => inspection,
    getContext: () => ({ controller, store, format, io, adapters, dialog }), message: setMessage, esc };
  window.ElectricalBackupUI = api;
})();
