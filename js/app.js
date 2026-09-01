/**
 * 电气工程师计算器 —— 核心框架
 *
 * 扩展方式：在 js/ 下新建一个模块文件，调用 ElectricalToolkit.register({...})
 * 即可自动出现在侧边导航并渲染。无需改动本文件。
 *
 * 注册项结构：
 * {
 *   id:      '唯一标识',                 // 用于路由 / 侧边项 key
 *   title:   '显示名称',
 *   icon:    '可选图标（当前工程主题的导航使用数字编号）',
 *   group:   '分组名',                   // 用于侧边栏分组
 *   desc:    '一句话简介',
 *   render:  function (host) { ... }     // 必填：向 host 容器写入该计算器界面
 * }
 */
(function (global) {
  'use strict';

  const registry = [];
  const ACTIVE_KEY = 'electrical_toolkit_active_calculator_v1';
  let activeId = null;
  let detachDraft = null;
  let flushDraft = null;

  const MODULE_ICONS = {
    'relay-fuse': '<path d="M2.5 5h4M11.5 5h4M6.5 5l5 3-5 3m5-3h4"/>',
    conductor: '<circle cx="4" cy="8" r="2"/><circle cx="14" cy="8" r="2"/><path d="M6 8h6"/>',
    precharge: '<path d="M2 8h3l1.2-2 2.4 4L11 6l1.2 2H16"/>',
    'bend-radius': '<path d="M3 14V9a6 6 0 0 1 6-6h5"/><path d="M11.5 1.5 14 3l-2.5 1.5"/>',
    tolerance: '<path d="M3 4v8m12-8v8M3 8h12M6 6 3 8l3 2m6-4 3 2-3 2"/>',
    bolt: '<path d="m5 3 6 0 3 5-3 5H5L2 8l3-5Z"/><circle cx="8" cy="8" r="2"/>',
    iec60664: '<path d="M2 5h5m4 0h5M2 11h5m4 0h5M7 3v4m4-4v4M7 9v4m4-4v4"/>',
    oring: '<circle cx="9" cy="8" r="5.5"/><circle cx="9" cy="8" r="2.5"/>',
    snapfit: '<path d="M3 3v10h8V9h4V5h-4V3"/>',
    'harness-od': '<path d="M2 5h14M2 8h14M2 11h14"/><path d="M5 3v10m8-10v10"/>',
    'busbar-temp': '<path d="M4 5h7v6H4z"/><path d="M13 3v7a2.5 2.5 0 1 0 2 0V3"/>',
    materials: '<ellipse cx="9" cy="4" rx="6" ry="2"/><path d="M3 4v4c0 1.1 2.7 2 6 2s6-.9 6-2V4M3 8v4c0 1.1 2.7 2 6 2s6-.9 6-2V8"/>',
    'part-estimator': '<rect x="3" y="2" width="12" height="13" rx="1"/><path d="M6 5h6M6 8h2m2 0h2M6 11h2m2 0h2"/>',
    'sor-generator': '<path d="M4 2h7l3 3v9H4z"/><path d="M11 2v3h3M6 8h6M6 11h5"/>',
    'engineering-formulas': '<path d="M4 3h10M4 13h10M6 5l3 3-3 3m5-5h3m-3 4h3"/>',
    'standards-library': '<path d="M3 3h5a2 2 0 0 1 2 2v9H5a2 2 0 0 0-2 1V3Zm7 2a2 2 0 0 1 2-2h3v12h-3a2 2 0 0 0-2 1"/>',
  };

  function moduleIcon(id) {
    const shape = MODULE_ICONS[id] || '<rect x="3" y="3" width="12" height="10"/><path d="M6 6h6M6 9h6"/>';
    return `<svg viewBox="0 0 18 16" aria-hidden="true" focusable="false">${shape}</svg>`;
  }

  const el = {
    nav: document.getElementById('nav'),
    content: document.getElementById('content'),
  };

  const toolkit = {
    /** 注册一个计算器模块 */
    register(calc) {
      if (!calc || typeof calc.id !== 'string' || !calc.id.trim() || typeof calc.render !== 'function') {
        throw new Error('计算器注册信息不完整（需要 id 与 render）');
      }
      const existingIndex = registry.findIndex((item) => item.id === calc.id);
      if (existingIndex >= 0) {
        if (calc.replace === true) {
          registry[existingIndex] = calc;
          return calc;
        }
        throw new Error(`计算器 id 重复：${calc.id}`);
      }
      registry.push(calc);
      return calc;
    },

    /** 按 id 查找 */
    get(id) {
      return registry.find((c) => c.id === id);
    },

    list() {
      return registry.slice();
    },

    /** 当前激活的计算器 */
    active() {
      return this.get(activeId);
    },

    /** 切换到指定计算器 */
    open(id) {
      const calc = this.get(id);
      if (!calc) return;
      if (flushDraft) flushDraft();
      if (detachDraft) detachDraft();
      detachDraft = flushDraft = null;
      activeId = id;
      try { localStorage.setItem(ACTIVE_KEY, activeId); } catch (error) { /* 本地存储不可用时不影响计算 */ }
      this.renderNav();
      this.renderContent();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderNav() {
      // 按 group 分组渲染
      const groups = [];
      registry.forEach((c) => {
        const g = c.group || '计算器';
        if (!groups.includes(g)) groups.push(g);
      });

      let html = '';
      groups.forEach((g) => {
        html += `<div class="nav-group-label">${escapeHtml(g)}</div>`;
        registry
          .filter((c) => (c.group || '计算器') === g)
          .forEach((c) => {
            const active = c.id === activeId ? ' active' : '';
            html += `<button class="nav-item${active}" data-id="${escapeHtml(c.id)}">
              <span class="ico">${moduleIcon(c.id)}</span><span>${escapeHtml(c.title)}</span>
            </button>`;
          });
      });

      el.nav.innerHTML = html;

      el.nav.querySelectorAll('.nav-item').forEach((btn) => {
        btn.addEventListener('click', () => toolkit.open(btn.dataset.id));
      });
    },

    renderContent(reset = false) {
      const calc = this.get(activeId);
      if (!calc) {
        el.content.innerHTML = '<div class="empty-tip">请从左侧选择一个计算器</div>';
        return;
      }

      el.content.innerHTML = '';
      const header = document.createElement('header');
      header.className = 'calc-header';
      header.innerHTML = `
        <div class="calc-kicker">${escapeHtml(calc.group || '工程计算')}</div>
        <h2>${escapeHtml(calc.title)}</h2>
        ${calc.desc ? `<p class="desc">${escapeHtml(calc.desc)}</p>` : ''}
      `;
      el.content.appendChild(header);

      const draftBar = document.createElement('div');
      draftBar.className = 'panel draft-toolbar';
      draftBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 16px';
      draftBar.innerHTML = '<span role="status" style="font-size:12px">编辑内容自动保存在当前浏览器（图片和附件一并保存）</span><button type="button" class="btn btn-ghost draft-reset">恢复当前模块默认值</button>';
      el.content.appendChild(draftBar);
      if (calc.resetLabel) draftBar.querySelector('.draft-reset').textContent = calc.resetLabel;

      const host = document.createElement('div');
      host.className = 'calc-body';
      el.content.appendChild(host);

      try {
        calc.render(host);
        const drafts = window.CalculatorDrafts;
        if (drafts) {
          const saved = reset ? null : drafts.read(calc.id);
          if (reset && calc.resetDraft) calc.resetDraft(host);
          if (saved) drafts.restore(calc, host, saved);
          const status = draftBar.querySelector('[role=status]');
          status.textContent = saved ? '已恢复上次编辑内容 · 后续修改自动保存至当前浏览器' : '编辑内容自动保存在当前浏览器（图片和附件一并保存）';
          let timer = null;
          let lastSnapshot = '';
          let saveRevision = 0;
          const persist = () => {
            clearTimeout(timer);
            try {
              const payload = drafts.capture(calc, host);
              const json = JSON.stringify(payload);
              if (json === lastSnapshot) return;
              lastSnapshot = json;
              const revision = ++saveRevision;
              status.textContent = '正在保存…';
              drafts.write(calc.id, payload).then((success) => {
                if (revision !== saveRevision) return;
                status.textContent = success ? '已保存至当前浏览器 · 切换模块或重新打开可继续编辑' : '浏览器保存失败，请立即导出 JSON 备份；当前内容仅在本次打开期间保留';
                if (!success) lastSnapshot = '';
              });
            } catch (error) {
              status.textContent = '草稿保存失败，请先导出 JSON 备份：' + error.message;
            }
          };
          const schedule = () => { clearTimeout(timer); timer = setTimeout(persist, 180); };
          ['input', 'change', 'click', 'paste'].forEach((type) => host.addEventListener(type, schedule, true));
          const observer = new MutationObserver(schedule);
          observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'src'] });
          flushDraft = persist;
          detachDraft = () => {
            clearTimeout(timer); observer.disconnect();
            ['input', 'change', 'click', 'paste'].forEach((type) => host.removeEventListener(type, schedule, true));
          };
          draftBar.querySelector('.draft-reset').addEventListener('click', () => {
            const warning = calc.resetLabel ? `恢复“${calc.title}”的默认查询？尚未保存到材料库的编辑草稿将被清除，已保存材料库不变。` : `恢复“${calc.title}”的默认值？当前模块的输入、添加的行及附件将被替换，其他模块不受影响。建议先导出 JSON 备份。`;
            if (!confirm(warning)) return;
            detachDraft(); detachDraft = flushDraft = null;
            this.renderContent(true);
          });
          persist();
        }
      } catch (error) {
        console.error(`计算器“${calc.id}”渲染失败`, error);
        host.innerHTML = `<div class="panel module-error">
          <h3>模块加载失败</h3>
          <p>“${escapeHtml(calc.title)}”未能正常打开。请保留完整工具目录，并确认相关脚本和数据文件没有被单独移动。</p>
          <code>${escapeHtml(error && error.message ? error.message : '未知错误')}</code>
        </div>`;
      }
    },
  };

  /** HTML 转义，防注入 */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** 数值解析：容忍逗号，空串返回 null */
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /** 数值格式化：自动选单位，去掉多余尾零 */
  function trimZeros(s) {
    if (s.indexOf('.') === -1) return s;
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }

  function fmt(n, digits = 4) {
    if (!Number.isFinite(n)) return '—';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e9) return trimZeros((n / 1e9).toFixed(digits - 1)) + ' G';
    if (abs >= 1e6) return trimZeros((n / 1e6).toFixed(digits - 1)) + ' M';
    if (abs >= 1e3) return trimZeros((n / 1e3).toFixed(digits - 1)) + ' k';
    if (abs >= 1) return trimZeros(n.toFixed(digits - 1));
    // 小于 1：直接显示小数（不用 m/µ/n 前缀，避免与单位本身的量纲混淆）
    if (abs >= 1e-6) return trimZeros(n.toFixed(10));
    return n.toExponential(3);
  }

  /** 精确格式化（不用缩写，保留原始数值与单位） */
  function fmtExact(n, digits = 4) {
    if (!Number.isFinite(n)) return '—';
    return String(parseFloat(n.toFixed(digits)));
  }

  /** 小工具集合，供各计算器复用 */
  const util = {
    parseNum,
    fmt,
    fmtExact,
    escapeHtml,
  };

  global.ElectricalToolkit = toolkit;
  global.ElUtil = util;

  // 模块加载完成后，优先恢复上次打开的计算器。
  window.addEventListener('pagehide', () => { if (flushDraft) flushDraft(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && flushDraft) flushDraft(); });
  window.addEventListener('load', async () => {
    if (window.CalculatorDrafts) await window.CalculatorDrafts.ready;
    if (!registry.length) return;
    let remembered = null;
    try { remembered = localStorage.getItem(ACTIVE_KEY); } catch (error) { /* ignore */ }
    const migratedId = remembered === 'rms-current' && toolkit.get('busbar-temp') ? 'busbar-temp' : remembered;
    toolkit.open(toolkit.get(migratedId) ? migratedId : registry[0].id);
  });
})(window);
