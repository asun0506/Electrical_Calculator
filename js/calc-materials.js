/**
 * 计算器 14：材料参数数据库
 *
 * 材料数据来自 js/materials-data.js（window.MATERIAL_DB，由 Excel 材料库解析）。
 * 按 金属 / 塑料 / 复合材料 分类，下拉选择具体材料，展示材料信息与应力–应变曲线。
 *
 * 用户能力：
 *  - 新增材料（保存到 localStorage，后续可调用）
 *  - 编辑已有材料并保存（localStorage 覆盖），base 版本保留不覆盖
 *  - 对单个材料一键"还原默认"（清除用户覆盖，恢复 base 值）
 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const CATS = ['金属', '塑料', '复合材料'];
  const LS_OVERRIDE = 'matdb_override'; // { name: {key:value} }
  const LS_CUSTOM = 'matdb_custom';     // { name: {完整材料} }

  const PARAMS = [
    { k: 'E', label: '杨氏模量 E', unit: 'MPa' },
    { k: 'nu', label: '泊松比 ν', unit: '—' },
    { k: 'dens', label: '密度 ρ', unit: 'g/cm³' },
    { k: 'G', label: '剪切模量 G', unit: 'MPa' },
    { k: 'Rp02', label: '屈服强度 Rp0.2', unit: 'MPa' },
    { k: 'Rm', label: '抗拉强度 Rm', unit: 'MPa' },
    { k: 'shear', label: '剪切强度', unit: 'MPa' },
    { k: 'elong', label: '断裂延伸率 A', unit: '%' },
    { k: 'lambda', label: '导热系数 λ', unit: 'W/(m·K)' },
    { k: 'Cp', label: '比热容 Cp', unit: 'J/(kg·K)' },
    { k: 'melt', label: '熔点/软化温度', unit: '°C' },
    { k: 'rho_e', label: '电阻率 ρe', unit: 'Ω·m' },
    { k: 'rho_v', label: '体积电阻率 ρv', unit: 'Ω·m' },
    { k: 'cond', label: '电导率 σ', unit: 'MS/m' },
    { k: 'IACS', label: 'IACS', unit: '%' },
    { k: 'Ed', label: '介电强度 Ed', unit: 'kV/mm' },
  ];

  function load(key) { try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; } }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (error) { alert('浏览器本地存储失败。请检查隐私模式或存储空间，并先导出数据备份。'); return false; }
  }
  const overrides = load(LS_OVERRIDE);
  const customs = load(LS_CUSTOM);
  let editing = false; // 是否处于"可修改参数"状态

  /** 获取完整材料列表（默认 + 自定义） */
  function allMaterials() {
    const all = {};
    Object.keys(window.MATERIAL_DB).forEach((n) => { all[n] = window.MATERIAL_DB[n]; });
    Object.keys(customs).forEach((n) => { all[n] = customs[n]; });
    return all;
  }

  /** 取得某材料"生效值"（base + 自定义 + 用户覆盖） */
  function effective(name) {
    const base = window.MATERIAL_DB[name] || customs[name] || {};
    const ov = overrides[name] || {};
    const mat = {};
    Object.keys(base).forEach((k) => { mat[k] = base[k]; });
    Object.keys(ov).forEach((k) => { mat[k] = ov[k]; });
    return mat;
  }

  function isCustom(name) { return name in customs; }
  function hasOverride(name) { return !!(overrides[name] && Object.keys(overrides[name]).length); }

  T.register({
    id: 'materials',
    resetLabel: '恢复默认查询（不删除材料库）',
    captureDraft(host) {
      return { category: host.querySelector('#mt-cat').value, name: currentName(), editing,
        newOpen: host.querySelector('#mt-new-form').style.display !== 'none',
        rows: ['mt', 'mtn'].map((prefix) => host.querySelectorAll(`#${prefix}-table-body tr:has(input)`).length) };
    },
    restoreDraft(saved, host) {
      host.querySelector('#mt-cat').value = saved.category;
      buildNameOptions(saved.name);
      render();
      if (saved.editing) enableEditing();
      if (saved.newOpen) toggleNewForm();
      ['mt', 'mtn'].forEach((prefix, index) => {
        const body = host.querySelector(`#${prefix}-table-body`);
        if (!body) return;
        const desired = saved.rows[index];
        while (body.querySelectorAll('tr:has(input)').length > desired) body.querySelector('tr:last-child').remove();
        while (body.querySelectorAll('tr:has(input)').length < desired) addCurveRow(prefix);
        updateRowNumbers(body);
      });
    },
    title: '材料数据库',
    icon: '🗂️',
    group: '材料库',
    desc: '金属/塑料/复合材料参数数据库：查看、编辑、新增材料并保存，可一键还原默认参数。',

    render(host) {
      host.innerHTML = `
        <div class="panel">
          <h3 class="panel-title"><span class="dot"></span>材料选择</h3>
          <div class="grid cols-3">
            <div class="field"><label>材料大类</label><select id="mt-cat"></select></div>
            <div class="field"><label>具体材料</label><select id="mt-name"></select></div>
            <div class="field" style="justify-content:flex-end">
              <div class="btn-row" style="margin:0">
                <button class="btn btn-primary" id="mt-query" type="button">查询材料</button>
                <button class="btn btn-ghost" id="mt-new" type="button">＋ 新增材料</button>
              </div>
            </div>
          </div>
        </div>

        <div id="mt-new-form" style="display:none"></div>

        <div class="panel" id="mt-detail"></div>

        <div class="panel" id="mt-actions"></div>
      `;

      buildCatOptions();
      // 默认展示 Al-1060-O（金属分类）
      const first = 'Al-1060-O';
      document.getElementById('mt-cat').value = window.MATERIAL_DB[first].category;
      buildNameOptions(first);
      document.getElementById('mt-name').value = first;

      document.getElementById('mt-cat').addEventListener('change', () => {
        const names = namesInCat(document.getElementById('mt-cat').value);
        buildNameOptions(names[0]);
      });
      // 选择材料后不自动刷新，点击"查询材料"才刷新下方参数信息
      document.getElementById('mt-query').addEventListener('click', () => render());
      document.getElementById('mt-new').addEventListener('click', toggleNewForm);

      render();
    },
  });

  function buildCatOptions() {
    const all = allMaterials();
    const used = Object.keys(all).map((n) => all[n].category);
    const opts = CATS.map((c) => `<option value="${c}" ${used.includes(c) ? '' : 'disabled'}>${c}</option>`).join('');
    document.getElementById('mt-cat').innerHTML = opts;
  }

  function namesInCat(cat) {
    const all = allMaterials();
    return Object.keys(all).filter((n) => all[n].category === cat);
  }

  function buildNameOptions(sel) {
    const cat = document.getElementById('mt-cat').value;
    const names = namesInCat(cat);
    const opts = names.map((n) => `<option value="${E.escapeHtml(n)}">${E.escapeHtml(n)}${isCustom(n) ? '（自定义）' : ''}</option>`).join('');
    document.getElementById('mt-name').innerHTML = opts;
    if (sel && names.includes(sel)) document.getElementById('mt-name').value = sel;
  }

  function currentName() { return document.getElementById('mt-name').value; }

  function render() {
    const name = currentName();
    if (!name) return;
    editing = false; // 每次渲染恢复为只读
    const mat = effective(name);
    const base = window.MATERIAL_DB[name];
    const custom = isCustom(name);
    const over = hasOverride(name);

    // 描述区
    const desc = `
      <div class="result-grid" style="margin-bottom:14px">
        <div class="result-card"><div class="k">材料名</div><div class="v" style="font-size:16px">${E.escapeHtml(mat.cn || '—')}</div></div>
        <div class="result-card"><div class="k">英文名</div><div class="v" style="font-size:15px">${E.escapeHtml(mat.en || '—')}</div></div>
        <div class="result-card"><div class="k">缩写</div><div class="v" style="font-size:15px">${E.escapeHtml(mat.abbr || '—')}</div></div>
        <div class="result-card"><div class="k">分类</div><div class="v" style="font-size:15px">${E.escapeHtml(mat.category || '—')}</div></div>
      </div>
      <div class="note" style="margin-bottom:14px"><b>特性：</b>${E.escapeHtml(mat.desc || '—')}<br><b>用途：</b>${E.escapeHtml(mat.use || '—')}</div>
    `;

    // 参数编辑表
    const fields = PARAMS.filter((p) => mat[p.k] !== undefined).map((p) => {
      const val = mat[p.k];
      const displayed = typeof val === 'number' ? String(val) : String(val);
      return `
        <div class="field"><label>${p.label}</label>
          <div class="input-row"><input type="number" step="any" class="mt-p" data-k="${p.k}" value="${E.escapeHtml(displayed)}" disabled><span class="unit">${p.unit}</span></div>
        </div>`;
    }).join('');

    // 应力应变曲线（生效值，含用户覆盖）——图表 + 数据点参数表（可编辑）
    const curve = (mat.curve && mat.curve.length) ? mat.curve : [];
    const canEditCurve = !!(base || custom); // base 或自定义材料均可编辑曲线
    let curveHtml = '';
    if (curve.length || canEditCurve) {
      curveHtml = `
        <div class="curve-layout" style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start;margin-top:18px">
          <div class="normal-chart-wrap" style="flex:1.4;min-width:340px">${T.lineChart({
            width: 720, height: 360,
            title: `工程应力–应变曲线（${name}）`,
            x: { label: '工程应变 ε', unit: '%' },
            y: { label: '工程应力 σ', unit: 'MPa' },
            series: [{ name: 'σ–ε', color: '#2563eb', points: curve }],
          })}</div>
          <div style="flex:1;min-width:300px">
            <h4 style="margin:0 0 8px;font-size:14px">曲线数据点（应变 ε % / 应力 σ MPa）${editing ? ' — 可编辑' : ''}</h4>
            ${curveTableHtml('mt', curve, editing)}
            <div class="note" style="margin-top:8px;font-size:12px">${curve.length ? (editing ? '可直接修改数值、点“＋ 添加数据点”增行、点删除按钮删行，保存后生效。' : '点击“修改参数”后可编辑曲线数据点。') : '该材料暂无曲线数据点，点击“修改参数”后可用“＋ 添加数据点”新建曲线。'}</div>
          </div>
        </div>`;
    }

    document.getElementById('mt-detail').innerHTML = `
      <h3 class="panel-title"><span class="dot"></span>材料详情（${E.escapeHtml(name)}）${over ? ' <span class="mt-badge">已修改</span>' : ''}${custom ? ' <span class="mt-badge custom">自定义</span>' : ''}</h3>
      ${desc}
      <h4 style="margin:0 0 10px;font-size:14px">特性参数（可编辑）</h4>
      <div class="grid cols-4">${fields || '<div class="empty-tip">该材料暂无标量参数。</div>'}</div>
      ${curveHtml}
    `;

    // 操作区
    document.getElementById('mt-actions').innerHTML = `
      <div class="btn-row">
        <button class="btn btn-primary" id="mt-edit">修改参数</button>
        <button class="btn btn-primary" id="mt-save" style="display:none">保存修改</button>
        ${!custom ? `<button class="btn btn-ghost" id="mt-reset" ${over ? '' : 'disabled'}>还原默认</button>` : `<button class="btn btn-ghost" id="mt-del">删除该自定义材料</button>`}
        <span class="io-hint" id="mt-hint">${over ? 'base 版本仍保留，可随时还原' : (custom ? '自定义材料' : '参数默认只读，点击"修改参数"确认后即可编辑')}</span>
      </div>
      <div class="io-row">
        <button class="btn btn-ghost btn-sm" id="mt-export">↑ 导出当前材料 Excel</button>
        <button class="btn btn-ghost btn-sm" id="mt-export-all">↑ 导出全部材料 Excel</button>
        <button class="btn btn-ghost btn-sm" id="mt-export-en">↑ 导出当前材料英文 Excel</button>
        <button class="btn btn-ghost btn-sm" id="mt-export-all-en">↑ 导出全部材料英文 Excel</button>
        <span class="io-hint">导出为 Excel(.xls) 表，含描述、全部参数与应力应变曲线</span>
      </div>
    `;

    document.getElementById('mt-export').addEventListener('click', () => exportCurrent());
    document.getElementById('mt-export-en').addEventListener('click', () => exportCurrent('en'));
    document.getElementById('mt-export-all').addEventListener('click', () => exportAll());
    document.getElementById('mt-export-all-en').addEventListener('click', () => exportAll('en'));
    document.getElementById('mt-edit').addEventListener('click', () => {
      if (!confirm('确认要修改默认材料参数吗？')) return;
      enableEditing();
    });
    document.getElementById('mt-save').addEventListener('click', saveCurrent);
    // 曲线表：添加数据点 / 删除行
    const curveAdd = document.getElementById('mt-curve-add');
    if (curveAdd) curveAdd.addEventListener('click', () => addCurveRow('mt'));
    document.querySelectorAll('#mt-detail .mt-curve-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        if (tr) { tr.remove(); updateRowNumbers(document.getElementById('mt-table-body')); }
      });
    });
    if (!custom) {
      const btn = document.getElementById('mt-reset');
      if (btn) btn.addEventListener('click', resetCurrent);
    } else {
      document.getElementById('mt-del').addEventListener('click', delCustom);
    }
  }

  function enableEditing() {
    editing = true;
    document.querySelectorAll('#mt-detail .mt-p,#mt-detail .mt-curve').forEach((input) => { input.disabled = false; });
    const add = document.getElementById('mt-curve-add');
    if (add) add.style.display = '';
    document.querySelectorAll('#mt-detail .mt-curve-del').forEach((button) => { button.style.display = ''; });
    document.getElementById('mt-edit').style.display = 'none';
    document.getElementById('mt-save').style.display = '';
    document.getElementById('mt-hint').textContent = '正在编辑，保存后写入并恢复只读';
  }

  /**
   * 生成应力应变曲线数据点表格（应变 ε % / 应力 σ MPa）。
   * prefix: 元素 class/id 前缀（mt-curve / mtn-curve）；editable: 是否可编辑。
   */
  function curveTableHtml(prefix, curve, editable) {
    const esc = E.escapeHtml;
    const rows = (curve || []).map((pt, i) => {
      const e = pt[0] !== undefined ? pt[0] : '';
      const s = pt[1] !== undefined ? pt[1] : '';
      return `<tr>
        <td style="text-align:center;color:#94a3b8;padding:3px 6px">${i + 1}</td>
        <td style="padding:3px 6px"><input type="number" step="any" class="${prefix}-curve" data-i="${i}" data-c="e" value="${esc(String(e))}" ${editable ? '' : 'disabled'} style="width:100%;min-width:70px"></td>
        <td style="padding:3px 6px"><input type="number" step="any" class="${prefix}-curve" data-i="${i}" data-c="s" value="${esc(String(s))}" ${editable ? '' : 'disabled'} style="width:100%;min-width:80px"></td>
        <td style="text-align:center;padding:3px 6px"><button class="btn btn-ghost btn-sm ${prefix}-curve-del" type="button" data-i="${i}" style="${editable ? '' : 'display:none'}">✕</button></td>
      </tr>`;
    }).join('');
    return `<div style="overflow:auto;max-height:360px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr>
          <th style="padding:3px 6px;text-align:center;color:#94a3b8">#</th>
          <th style="padding:3px 6px;text-align:left">应变 ε (%)</th>
          <th style="padding:3px 6px;text-align:left">应力 σ (MPa)</th>
          <th style="padding:3px 6px;width:36px"></th>
        </tr></thead>
        <tbody id="${prefix}-table-body">${rows || `<tr><td colspan="4" style="padding:10px;text-align:center;color:#94a3b8">暂无数据点</td></tr>`}</tbody>
      </table>
      <button class="btn btn-ghost btn-sm" id="${prefix}-curve-add" type="button" style="${editable ? '' : 'display:none'};margin-top:8px">＋ 添加数据点</button>
    </div>`;
  }

  /** 从曲线表格读取数据点 [[ε, σ], ...]（跳过不完整的行） */
  function readCurveTable(prefix, scopeSel) {
    const inputs = document.querySelectorAll(scopeSel + ' .' + prefix + '-curve');
    const map = {};
    inputs.forEach((inp) => {
      const i = parseInt(inp.dataset.i, 10);
      const c = inp.dataset.c;
      const v = parseFloat(inp.value);
      if (!Number.isFinite(v)) return;
      if (!map[i]) map[i] = [null, null];
      map[i][c === 'e' ? 0 : 1] = v;
    });
    return Object.keys(map).sort((a, b) => a - b)
      .map((i) => map[i])
      .filter((p) => p[0] !== null && p[1] !== null);
  }

  /** 向曲线表格末尾添加一行（并刷新序号） */
  function addCurveRow(prefix) {
    const tbody = document.getElementById(prefix + '-table-body');
    if (!tbody) return;
    let maxI = -1;
    tbody.querySelectorAll('.' + prefix + '-curve').forEach((inp) => {
      maxI = Math.max(maxI, parseInt(inp.dataset.i, 10) || 0);
    });
    const i = maxI + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center;color:#94a3b8;padding:3px 6px"></td>
      <td style="padding:3px 6px"><input type="number" step="any" class="${prefix}-curve" data-i="${i}" data-c="e" style="width:100%;min-width:70px"></td>
      <td style="padding:3px 6px"><input type="number" step="any" class="${prefix}-curve" data-i="${i}" data-c="s" style="width:100%;min-width:80px"></td>
      <td style="text-align:center;padding:3px 6px"><button class="btn btn-ghost btn-sm ${prefix}-curve-del" type="button" data-i="${i}">✕</button></td>`;
    tr.querySelector('button').addEventListener('click', () => { tr.remove(); updateRowNumbers(tbody); });
    tbody.appendChild(tr);
    updateRowNumbers(tbody);
    tr.querySelector('input[data-c="e"]').focus();
  }

  /** 刷新曲线表格行号 */
  function updateRowNumbers(tbody) {
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), (tr, idx) => {
      const td = tr.querySelector('td');
      if (td) td.textContent = idx + 1;
    });
  }

  function saveCurrent() {
    const name = currentName();
    const ov = overrides[name] || {};
    document.querySelectorAll('#mt-detail .mt-p').forEach((inp) => {
      const value = inp.value.trim();
      if (value === '') delete ov[inp.dataset.k];
      else ov[inp.dataset.k] = Number(value);
    });
    // 保存应力应变曲线（读取表格，去空行后写入）
    const curve = readCurveTable('mt', '#mt-detail');
    if (curve.length) ov.curve = curve; else delete ov.curve;
    overrides[name] = ov;
    save(LS_OVERRIDE, overrides);
    editing = false;
    render();
  }

  function resetCurrent() {
    const name = currentName();
    delete overrides[name];
    save(LS_OVERRIDE, overrides);
    render();
  }

  function delCustom() {
    const name = currentName();
    delete customs[name];
    save(LS_CUSTOM, customs);
    delete overrides[name];
    save(LS_OVERRIDE, overrides);
    buildNameOptions(namesInCat(document.getElementById('mt-cat').value)[0]);
    render();
  }

  function toggleNewForm() {
    const box = document.getElementById('mt-new-form');
    if (box.style.display === 'block') { box.style.display = 'none'; return; }
    const paramInputs = PARAMS.map((p) =>
      `<div class="field"><label>${p.label}（${p.unit}）</label><div class="input-row"><input type="number" step="any" class="mtn-p" data-k="${p.k}"></div></div>`).join('');
    box.innerHTML = `
      <div class="panel">
        <h3 class="panel-title"><span class="dot"></span>新增材料</h3>
        <div class="grid cols-3">
          <div class="field"><label>材料大类</label><select id="mtn-cat">${CATS.map((c) => `<option>${c}</option>`).join('')}</select></div>
          <div class="field"><label>名称（英文/牌号，唯一标识）</label><div class="input-row"><input id="mtn-name" type="text"></div></div>
          <div class="field"><label>材料名（中文）</label><div class="input-row"><input id="mtn-cn" type="text"></div></div>
          <div class="field"><label>英文名</label><div class="input-row"><input id="mtn-en" type="text"></div></div>
          <div class="field"><label>缩写</label><div class="input-row"><input id="mtn-abbr" type="text"></div></div>
          <div class="field"><label>分类(只读)</label><div class="input-row"><input id="mtn-cat-show" type="text" value=""></div></div>
        </div>
        <div class="field" style="margin-top:12px"><label>特性</label><div class="input-row"><input id="mtn-desc" type="text"></div></div>
        <div class="field" style="margin-top:8px"><label>用途</label><div class="input-row"><input id="mtn-use" type="text"></div></div>
        <h4 style="margin:14px 0 10px;font-size:14px">特性参数（填需要的，其余留空）</h4>
        <div class="grid cols-4">${paramInputs}</div>
        <h4 style="margin:18px 0 10px;font-size:14px">应力–应变曲线数据点（可选，应变 ε % / 应力 σ MPa）</h4>
        <div style="max-width:460px">${curveTableHtml('mtn', [], true)}</div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-primary" id="mtn-save">保存新增材料</button>
          <button class="btn btn-ghost" id="mtn-cancel">取消</button>
        </div>
      </div>
    `;
    document.getElementById('mtn-cat').addEventListener('change', syncCat);
    document.getElementById('mtn-save').addEventListener('click', saveNew);
    document.getElementById('mtn-cancel').addEventListener('click', toggleNewForm);
    // 新增表单曲线：添加/删除行
    const mtnAdd = document.getElementById('mtn-curve-add');
    if (mtnAdd) mtnAdd.addEventListener('click', () => addCurveRow('mtn'));
    document.querySelectorAll('#mt-new-form .mtn-curve-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr');
        if (tr) { tr.remove(); updateRowNumbers(document.getElementById('mtn-table-body')); }
      });
    });
    syncCat();
    box.style.display = 'block';
  }
  function syncCat() { document.getElementById('mtn-cat-show').value = document.getElementById('mtn-cat').value; }

  function saveNew() {
    const name = document.getElementById('mtn-name').value.trim();
    if (!name) { alert('请填写材料名称（唯一标识）。'); return; }
    if (name in window.MATERIAL_DB || name in customs) { alert('该材料名已存在。'); return; }
    const mat = {
      category: document.getElementById('mtn-cat').value,
      name,
      cn: document.getElementById('mtn-cn').value.trim() || name,
      en: document.getElementById('mtn-en').value.trim(),
      abbr: document.getElementById('mtn-abbr').value.trim(),
      desc: document.getElementById('mtn-desc').value.trim(),
      use: document.getElementById('mtn-use').value.trim(),
    };
    document.querySelectorAll('#mt-new-form .mtn-p').forEach((inp) => {
      const v = inp.value.trim();
      if (v !== '') mat[inp.dataset.k] = parseFloat(v);
    });
    // 保存新增材料的应力应变曲线（去空行）
    const curve = readCurveTable('mtn', '#mt-new-form');
    if (curve.length) mat.curve = curve;
    customs[name] = mat;
    save(LS_CUSTOM, customs);
    document.getElementById('mt-new-form').style.display = 'none';
    document.getElementById('mt-cat').value = mat.category;
    buildNameOptions(name);
    document.getElementById('mt-name').value = name;
    render();
  }

  /** 生成单个材料的 Excel(HTML) 表格：描述 + 参数 + 应力应变曲线 */
  function buildSheetHtml(name, mat, curve, lang = 'zh') {
    const r = T.reportLanguage(lang);
    const esc = E.escapeHtml;
    const meta = `<tr><td>${esc(mat.cn || '')}</td><td>${esc(mat.en || '')}</td><td>${esc(mat.abbr || '')}</td><td>${esc(r(mat.category))}</td></tr>`;
    const propRows = PARAMS.filter((p) => mat[p.k] !== undefined)
      .map((p) => `<tr><td>${r(p.label)}</td><td>${p.unit}</td><td>${mat[p.k]}</td><td></td></tr>`).join('');
    const curveRows = (curve || []).map(([e, s]) => `<tr><td>${e}</td><td>${s}</td></tr>`).join('');
    return r`
      <h3>${esc(name)}</h3>
      <table border="1">
        <tr><th>材料名</th><th>英文名</th><th>缩写</th><th>分类</th></tr>${meta}
        <tr><td colspan="4"><b>特性：</b>${esc(mat.desc || '')}</td></tr>
        <tr><td colspan="4"><b>用途：</b>${esc(mat.use || '')}</td></tr>
      </table>
      <table border="1">
        <tr><th>特性参数</th><th>典型单位</th><th>数值</th><th>说明</th></tr>${propRows}
      </table>
      <table border="1">
        <tr><th>工程应变 ε / %</th><th>工程应力 σ / MPa</th></tr>${curveRows}
      </table>
      <br>`;
  }

  function downloadXls(html, filename, lang = 'zh') {
    const full = '<html lang="' + lang + '" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' + html + '</body></html>';
    const blob = new Blob(['﻿' + full], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function exportCurrent(lang = 'zh') {
    const name = currentName();
    const mat = effective(name);
    const curve = mat.curve || [];
    downloadXls(buildSheetHtml(name, mat, curve, lang), name + (lang === 'en' ? '_EN' : '') + '.xls', lang);
  }

  function exportAll(lang = 'zh') {
    const all = allMaterials();
    let html = '';
    Object.keys(all).forEach((n) => {
      html += buildSheetHtml(n, effective(n), effective(n).curve || [], lang);
    });
    downloadXls(html, lang === 'en' ? 'Material_Database_EN.xls' : '材料数据库全量.xls', lang);
  }
})();
