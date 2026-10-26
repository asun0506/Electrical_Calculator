/* Shared module-project controls. Inputs here never enter calculator payloads. */
(function () {
  'use strict';
  const esc = value => window.ElectricalSafety.escapeHtml(value);
  function nameDialog(title, initial = '') {
    return new Promise(resolve => {
      const trigger = document.activeElement, dialog = document.createElement('dialog');
      dialog.className = 'workspace-dialog';
      dialog.innerHTML = `<form method="dialog"><h3>${esc(title)}</h3><label>项目名称<input name="projectName" required maxlength="120" value="${esc(initial)}"></label><p class="workspace-dialog-actions"><button type="button" data-cancel>取消</button><button type="submit" class="btn btn-primary" value="save">保存</button></p></form>`;
      dialog.querySelector('[data-cancel]').onclick = () => dialog.close('cancel');
      dialog.addEventListener('close', () => { const value = dialog.returnValue === 'save' ? dialog.querySelector('input').value.trim() : null; dialog.remove(); trigger?.focus(); resolve(value); }, { once: true });
      document.body.append(dialog); dialog.showModal(); dialog.querySelector('input').focus(); dialog.querySelector('input').select();
    });
  }
  function manageDialog(calc, controller) {
    if (document.querySelector('dialog.project-manager[open]')) return;
    const trigger = document.activeElement, dialog = document.createElement('dialog');
    let busy = false;
    dialog.className = 'workspace-dialog project-manager';
    dialog.setAttribute('aria-labelledby', 'project-manager-title');
    dialog.innerHTML = `<h2 id="project-manager-title">项目管理 · ${esc(calc.title)}</h2><p>仅管理当前功能的项目。删除需单独操作并再次确认；至少保留一个项目，本地历史备份不受影响。</p><div class="project-manager-list"></div><p data-manager-status role="status" aria-live="polite"></p><div class="workspace-dialog-actions"><button type="button" data-close-manager>关闭</button></div>`;
    const status = text => { dialog.querySelector('[data-manager-status]').textContent = text; };
    function render() {
      if (!dialog.isConnected) return;
      const projects = controller.projects(), active = controller.session()?.projectId;
      dialog.querySelector('.project-manager-list').innerHTML = projects.map(project => `<div class="project-manager-row" data-managed-id="${esc(project.id)}"><div><strong>${esc(project.name)}</strong>${project.id === active ? '<span class="project-current-badge">当前项目</span>' : ''}<small>更新于 ${esc(project.updatedAt.slice(0, 16).replace('T', ' '))}</small></div><div class="project-manager-actions"><button type="button" data-managed-action="open" ${project.id === active || busy ? 'disabled' : ''}>切换</button><button type="button" data-managed-action="rename" ${busy ? 'disabled' : ''}>重命名</button><button type="button" data-managed-action="copy" ${busy ? 'disabled' : ''}>复制</button><button type="button" class="project-delete" data-managed-action="delete" ${projects.length <= 1 || busy ? 'disabled' : ''}>删除</button></div></div>`).join('');
      dialog.querySelector('[data-close-manager]').disabled = busy;
    }
    dialog.querySelector('[data-close-manager]').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { dialog.remove(); (trigger?.isConnected ? trigger : document.querySelector('[data-project-action=manage]'))?.focus(); }, { once: true });
    dialog.querySelector('.project-manager-list').addEventListener('click', async event => {
      const button = event.target.closest('[data-managed-action]');
      if (!button || button.disabled || busy) return;
      if (controller.session()?.moduleId !== calc.id) { status('当前功能已变化，请关闭窗口后重新打开管理。'); return; }
      const id = button.closest('[data-managed-id]').dataset.managedId, project = controller.projects().find(item => item.id === id);
      if (!project) { render(); status('该项目已不存在。'); return; }
      const action = button.dataset.managedAction;
      busy = true; render(); status('');
      try {
        let result;
        if (action === 'delete') {
          if (controller.projects().length <= 1) { status('至少保留一个项目，不能删除最后一个项目。'); return; }
          if (!confirm(`删除项目“${project.name}”？此操作不会删除本地历史备份。确定继续？`)) return;
          result = await controller.deleteProject(id);
        } else if (action === 'open') result = await controller.open(calc.id, id);
        else {
          const name = await nameDialog(action === 'rename' ? '重命名项目' : '复制项目', project.name + (action === 'copy' ? ' 副本' : ''));
          if (!name) return;
          if (action === 'rename') result = await controller.renameProject(name, id);
          else {
            result = controller.session()?.projectId === id ? { ok: true } : await controller.open(calc.id, id);
            if (result.ok) result = await controller.copyProject(name);
          }
        }
        status(result.ok ? '操作已完成并保存至当前浏览器。' : '操作未完成：' + result.error.message);
      } catch (error) { status('操作未完成：' + error.message); }
      finally { busy = false; render(); }
    });
    document.body.append(dialog); render(); dialog.showModal();
  }
  function createFrame(calc, isProject, controller) {
    const container = document.getElementById('content'); container.replaceChildren();
    const header = document.createElement('header'); header.className = 'calc-header';
    header.innerHTML = `<div class="calc-kicker">${esc(calc.group || '工程计算')}</div><h2>${esc(calc.title)}</h2><p class="desc">${esc(calc.desc || '')}</p>`;
    const toolbar = document.createElement('div'); toolbar.className = 'panel draft-toolbar project-toolbar';
    toolbar.innerHTML = `${isProject ? '<label class="project-selector">当前项目 <select data-project-select aria-label="当前功能项目"></select></label><div class="project-actions"><button type="button" data-project-action="new">＋ 新建</button><button type="button" data-project-action="rename">重命名</button><button type="button" data-project-action="copy">复制</button><button type="button" data-project-action="manage">管理</button><button type="button" data-project-action="import">导入项目</button><button type="button" data-project-action="export">导出项目</button></div>' : ''}<span role="status" aria-live="polite">正在恢复…</span><button type="button" class="btn btn-ghost draft-reset">${esc(calc.resetLabel || '恢复当前项目默认值')}</button>`;
    const host = document.createElement('div'); host.className = 'calc-body';
    container.append(header, toolbar, host);
    toolbar.querySelector('[data-project-select]')?.addEventListener('change', async event => {
      const result = await controller.open(calc.id, event.target.value);
      if (!result.ok) controller.refreshToolbar();
    });
    toolbar.querySelectorAll('[data-project-action]').forEach(button => button.addEventListener('click', async () => {
      const action = button.dataset.projectAction;
      if (action === 'export' || action === 'import') {
        if (!window.ElectricalBackupUI) { controller.message('项目备份功能正在加载'); return; }
        await window.ElectricalBackupUI.projectTransfer(action); return;
      }
      if (action === 'manage') {
        manageDialog(calc, controller);
        return;
      }
      const current = controller.currentProject();
      const name = await nameDialog(action === 'new' ? '新建项目' : action === 'copy' ? '复制项目' : '重命名项目', action === 'new' ? '新项目' : current.name + (action === 'copy' ? ' 副本' : ''));
      if (!name) return;
      if (action === 'new') await controller.newProject(name);
      else if (action === 'copy') await controller.copyProject(name);
      else await controller.renameProject(name);
    }));
    toolbar.querySelector('.draft-reset').addEventListener('click', async () => {
      if (confirm(isProject ? '恢复当前项目默认值？当前项目的输入和附件会被替换，其他项目不受影响。建议先导出备份。' : '恢复默认查询？已保存的用户材料库不受影响。')) await controller.reset();
    });
    return { host, toolbar, status: toolbar.querySelector('[role=status]') };
  }
  function mountProjectToolbar(toolbar, controller) {
    const select = toolbar.querySelector('[data-project-select]');
    if (!select) return;
    select.innerHTML = controller.projects().map(project => `<option value="${esc(project.id)}">${esc(project.name)} · ${esc(project.updatedAt.slice(0, 16).replace('T', ' '))}</option>`).join('');
    select.value = controller.session()?.projectId || '';
  }
  window.ElectricalProjectUI = { createFrame, mountProjectToolbar, nameDialog };
})();
