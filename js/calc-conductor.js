/**
 * 导体电阻项目校核
 *
 * 单段与多段使用同一套数据模型：
 *   R单根 = ρ(T) × L / A
 *   同规格数量可选择串联（nR）或并联（R/n）
 *   不同导体段通过 R1..Rn、+、//、() 组成串/并/混联网络
 */
(function () {
  'use strict';

  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  let hostRef;
  let state;
  let idSeq = 0;

  const MATERIALS = {
    copper: { name: '铜 Cu（退火）', rho: 1.72e-8, alpha: 0.00393 },
    copper_hard: { name: '铜 Cu（硬拉）', rho: 1.77e-8, alpha: 0.00393 },
    aluminum: { name: '铝 Al', rho: 2.82e-8, alpha: 0.00403 },
    silver: { name: '银 Ag', rho: 1.59e-8, alpha: 0.0038 },
    gold: { name: '金 Au', rho: 2.44e-8, alpha: 0.0034 },
    iron: { name: '铁 Fe', rho: 9.71e-8, alpha: 0.005 },
    brass: { name: '黄铜（60Cu40Zn）', rho: 6.5e-8, alpha: 0.0015 },
    tin: { name: '锡 Sn', rho: 1.1e-7, alpha: 0.0042 },
    steel: { name: '钢（低碳）', rho: 1.4e-7, alpha: 0.005 },
  };

  const RESISTANCE_UNITS = {
    ohm: { label: 'Ω', factor: 1 },
    mohm: { label: 'mΩ', factor: 1e3 },
    uohm: { label: 'μΩ', factor: 1e6 },
  };

  function esc(value) {
    return E.escapeHtml(value == null ? '' : String(value));
  }

  function nextId() {
    idSeq += 1;
    return `conductor_${Date.now()}_${idSeq}`;
  }

  function newConductor(index, overrides = {}) {
    return {
      id: nextId(),
      name: `导体段 ${index}`,
      material: 'copper',
      lengthMm: 500,
      widthMm: 5,
      heightMm: 1,
      temperatureC: 20,
      quantity: 1,
      quantityRelation: 'parallel',
      image: null,
      ...overrides,
    };
  }

  function defaultState() {
    return {
      schemaVersion: 2,
      displayUnit: 'mohm',
      expression: 'R1',
      limitValue: '',
      limitUnit: 'mohm',
      conductors: [newConductor(1)],
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function materialOptions(selected) {
    return Object.entries(MATERIALS).map(([key, item]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${item.name}</option>`).join('');
  }

  function unitOptions(selected) {
    return Object.entries(RESISTANCE_UNITS).map(([key, item]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${item.label}</option>`).join('');
  }

  function rowHtml(item, index) {
    const image = item.image;
    return `<div class="cd-segment-row" data-conductor-id="${esc(item.id)}">
      <div class="cd-ref"><b>R${index + 1}</b></div>
      <input data-field="name" value="${esc(item.name)}" aria-label="R${index + 1} 名称">
      <select data-field="material" aria-label="R${index + 1} 材质">${materialOptions(item.material)}</select>
      <input data-field="lengthMm" type="number" min="0" step="any" value="${esc(item.lengthMm)}" aria-label="长度 mm">
      <input data-field="widthMm" type="number" min="0" step="any" value="${esc(item.widthMm)}" aria-label="宽度 mm">
      <input data-field="heightMm" type="number" min="0" step="any" value="${esc(item.heightMm)}" aria-label="厚度 mm">
      <input data-field="temperatureC" type="number" step="any" value="${esc(item.temperatureC)}" aria-label="温度 °C">
      <input data-field="quantity" type="number" min="1" step="1" value="${esc(item.quantity)}" aria-label="数量">
      <select data-field="quantityRelation" aria-label="同规格导体关系">
        <option value="parallel" ${item.quantityRelation === 'parallel' ? 'selected' : ''}>并联 R/n</option>
        <option value="series" ${item.quantityRelation === 'series' ? 'selected' : ''}>串联 nR</option>
      </select>
      <div class="cd-row-image">${image
        ? `<img src="${esc(image.dataUrl)}" alt="${esc(image.name)}"><span title="${esc(image.name)}">${esc(image.name)}</span><button type="button" data-remove-image="${esc(item.id)}">移除</button>`
        : `<label class="btn cd-file-btn">添加图片<input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" data-row-image="${esc(item.id)}"></label>`}</div>
      <button class="row-del" type="button" data-delete-row="${esc(item.id)}" title="删除该段" ${state.conductors.length === 1 ? 'disabled' : ''}>✕</button>
    </div>`;
  }

  function render() {
    hostRef.innerHTML = `<style>${moduleStyle()}</style>
      <section class="panel cd-toolbar">
        <div><h3>导体电阻项目校核</h3><p>单段、多段使用同一套校核。每段可命名、设置同规格数量及串并联关系，并附加设计截图。</p></div>
        <div class="cd-actions">
          <button type="button" class="btn" id="cdExportJson">导出 JSON</button>
          <label class="btn cd-file-btn">导入 JSON<input id="cdImportJson" type="file" accept="application/json,.json"></label>
          <button type="button" class="btn danger" id="cdClear">一键清空</button>
          <button type="button" class="btn primary" id="cdExportPdf">打印 / 导出 PDF</button>
        </div>
      </section>

      <section class="panel">
        <div class="cd-settings">
          <label><span>电阻显示单位</span><select id="cdDisplayUnit">${unitOptions(state.displayUnit)}</select></label>
          <label><span>总电阻上限（可选）</span><div class="input-row"><input id="cdLimitValue" type="number" min="0" step="any" value="${esc(state.limitValue)}" placeholder="不填则仅计算"><select id="cdLimitUnit">${unitOptions(state.limitUnit)}</select></div></label>
          <div class="note">温度修正：ρ(T)=ρ20×[1+α(T−20°C)]。截面按矩形宽×厚计算。</div>
        </div>
      </section>

      <section class="panel">
        <div class="cd-section-head"><div><h3 class="panel-title"><span class="dot"></span>导体段</h3><p>R1、R2 是表达式引用；“名称”可填写母排、线束、连接片等实际对象。</p></div><button type="button" class="btn" id="cdAdd">＋ 添加导体段</button></div>
        <div class="cd-table-scroll">
          <div class="cd-segment-head"><span>引用</span><span>名称</span><span>材质</span><span>长度/mm</span><span>宽/mm</span><span>厚/mm</span><span>温度/°C</span><span>数量</span><span>同规格关系</span><span>附图</span><span></span></div>
          <div id="cdRows">${state.conductors.map(rowHtml).join('')}</div>
        </div>
      </section>

      <section class="panel">
        <h3 class="panel-title"><span class="dot"></span>导体段组合</h3>
        <div class="field"><label>组合表达式 <span class="hint">+ 表示串联，// 表示并联，括号用于分组</span></label><input id="cdExpression" value="${esc(state.expression)}" spellcheck="false"></div>
        <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="cdAllSeries">全部串联</button><button type="button" class="btn btn-ghost btn-sm" id="cdAllParallel">全部并联</button></div>
        <div class="note">示例：<code class="formula-line">R1 + (R2 // R3)</code>。只有一段导体时直接填写 <code class="formula-line">R1</code>。</div>
      </section>

      <section class="panel" id="cdResult"></section>
      <section class="cd-report-shell" id="cdReportShell"></section>`;
    bindEvents();
    calculateAndRender();
  }

  function bindEvents() {
    hostRef.querySelectorAll('[data-conductor-id] input[data-field], [data-conductor-id] select[data-field]').forEach((control) => control.addEventListener('input', handleRowInput));
    hostRef.querySelectorAll('[data-delete-row]').forEach((button) => button.addEventListener('click', () => deleteRow(button.dataset.deleteRow)));
    hostRef.querySelectorAll('[data-row-image]').forEach((input) => input.addEventListener('change', importRowImage));
    hostRef.querySelectorAll('[data-remove-image]').forEach((button) => button.addEventListener('click', () => {
      const item = state.conductors.find((row) => row.id === button.dataset.removeImage);
      if (item) item.image = null;
      render();
    }));
    hostRef.querySelector('#cdAdd').addEventListener('click', addRow);
    hostRef.querySelector('#cdExpression').addEventListener('input', (event) => { state.expression = event.target.value; calculateAndRender(); });
    hostRef.querySelector('#cdDisplayUnit').addEventListener('change', (event) => { state.displayUnit = event.target.value; calculateAndRender(); });
    hostRef.querySelector('#cdLimitValue').addEventListener('input', (event) => { state.limitValue = event.target.value; calculateAndRender(); });
    hostRef.querySelector('#cdLimitUnit').addEventListener('change', (event) => { state.limitUnit = event.target.value; calculateAndRender(); });
    hostRef.querySelector('#cdAllSeries').addEventListener('click', () => setAllExpression('+'));
    hostRef.querySelector('#cdAllParallel').addEventListener('click', () => setAllExpression('//'));
    hostRef.querySelector('#cdExportJson').addEventListener('click', exportJson);
    hostRef.querySelector('#cdImportJson').addEventListener('change', importJson);
    hostRef.querySelector('#cdClear').addEventListener('click', clearProject);
    hostRef.querySelector('#cdExportPdf').addEventListener('click', exportPdf);
  }

  function handleRowInput(event) {
    const row = event.target.closest('[data-conductor-id]');
    const item = state.conductors.find((entry) => entry.id === row.dataset.conductorId);
    if (!item) return;
    item[event.target.dataset.field] = event.target.value;
    calculateAndRender();
  }

  function addRow() {
    state.conductors.push(newConductor(state.conductors.length + 1, { lengthMm: 100 }));
    state.expression = allExpression('+');
    render();
  }

  function deleteRow(id) {
    if (state.conductors.length <= 1) return;
    state.conductors = state.conductors.filter((item) => item.id !== id);
    state.expression = allExpression('+');
    render();
  }

  function allExpression(operator) {
    return state.conductors.map((item, index) => `R${index + 1}`).join(` ${operator} `);
  }

  function setAllExpression(operator) {
    state.expression = allExpression(operator);
    hostRef.querySelector('#cdExpression').value = state.expression;
    calculateAndRender();
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function importRowImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      window.alert('导体附图请使用 PNG 或 JPG 格式。');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      window.alert('单张图片不能超过 10 MB。');
      return;
    }
    const item = state.conductors.find((row) => row.id === event.target.dataset.rowImage);
    if (!item) return;
    item.image = { name: file.name, type: file.type, size: file.size, dataUrl: await readFileDataUrl(file) };
    render();
  }

  function tokenize(expression) {
    const tokens = [];
    let index = 0;
    while (index < expression.length) {
      const char = expression[index];
      if (/\s/.test(char)) { index += 1; continue; }
      if (char === '+' || char === '(' || char === ')') { tokens.push(char); index += 1; continue; }
      if (char === '/' && expression[index + 1] === '/') { tokens.push('//'); index += 2; continue; }
      const number = expression.slice(index).match(/^\d+(?:\.\d+)?/);
      if (number) { tokens.push(Number(number[0])); index += number[0].length; continue; }
      const reference = expression.slice(index).match(/^R\s*(\d+)/i);
      if (reference) { tokens.push(`R${Number(reference[1])}`); index += reference[0].length; continue; }
      throw new Error(`无法识别的字符“${char}”`);
    }
    return tokens;
  }

  function evaluateExpression(tokens, resistanceMap) {
    let position = 0;
    function parseTerm() {
      const token = tokens[position];
      if (token === '(') {
        position += 1;
        const value = parseExpression();
        if (tokens[position] !== ')') throw new Error('缺少右括号 )');
        position += 1;
        return value;
      }
      if (typeof token === 'number') { position += 1; return token; }
      if (typeof token === 'string' && /^R\d+$/.test(token)) {
        position += 1;
        const number = Number(token.slice(1));
        if (!(number in resistanceMap)) throw new Error(`导体段 R${number} 未定义`);
        return resistanceMap[number];
      }
      throw new Error(`表达式错误（${token == null ? '末尾' : token}附近）`);
    }
    function parseExpression() {
      let value = parseTerm();
      while (position < tokens.length && ['+', '//'].includes(tokens[position])) {
        const operator = tokens[position++];
        const right = parseTerm();
        value = operator === '+' ? value + right : (value * right) / (value + right);
      }
      return value;
    }
    const result = parseExpression();
    if (position !== tokens.length) throw new Error('表达式存在多余内容');
    return result;
  }

  function computeProject() {
    const segments = [];
    const resistanceMap = {};
    for (let index = 0; index < state.conductors.length; index += 1) {
      const item = state.conductors[index];
      const material = MATERIALS[item.material];
      const lengthMm = E.parseNum(item.lengthMm);
      const widthMm = E.parseNum(item.widthMm);
      const heightMm = E.parseNum(item.heightMm);
      const temperatureC = E.parseNum(item.temperatureC);
      const quantity = E.parseNum(item.quantity);
      if (!material || [lengthMm, widthMm, heightMm, temperatureC, quantity].some((value) => value == null)) throw new Error(`R${index + 1}“${item.name || '未命名'}”参数未填写完整`);
      if (lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) throw new Error(`R${index + 1} 的长度、宽度和厚度必须大于 0`);
      if (quantity < 1 || !Number.isInteger(quantity)) throw new Error(`R${index + 1} 的数量必须是大于等于 1 的整数`);
      const rhoT = material.rho * (1 + material.alpha * (temperatureC - 20));
      if (rhoT <= 0) throw new Error(`R${index + 1} 的温度修正后电阻率无效`);
      const areaMm2 = widthMm * heightMm;
      const singleResistance = rhoT * (lengthMm / 1000) / (areaMm2 / 1e6);
      const effectiveResistance = item.quantityRelation === 'series' ? singleResistance * quantity : singleResistance / quantity;
      resistanceMap[index + 1] = effectiveResistance;
      segments.push({ index: index + 1, item, material, lengthMm, widthMm, heightMm, temperatureC, quantity, rhoT, areaMm2, singleResistance, effectiveResistance });
    }
    const totalResistance = evaluateExpression(tokenize(state.expression.trim()), resistanceMap);
    if (!Number.isFinite(totalResistance) || totalResistance <= 0) throw new Error('组合总电阻无效，请检查串并联表达式');
    const limitNumber = E.parseNum(state.limitValue);
    const limitOhm = limitNumber == null ? null : limitNumber / RESISTANCE_UNITS[state.limitUnit].factor;
    if (limitOhm != null && limitOhm < 0) throw new Error('总电阻上限不能小于 0');
    return { segments, totalResistance, limitOhm, passed: limitOhm == null ? null : totalResistance <= limitOhm };
  }

  function resistanceText(valueOhm, unitKey = state.displayUnit) {
    const unit = RESISTANCE_UNITS[unitKey];
    return `${E.fmtExact(valueOhm * unit.factor, 6)} ${unit.label}`;
  }

  function resultTable(result, report = false) {
    return `<table class="param-table cd-result-table"><thead><tr><th>引用 / 名称</th><th>材质</th><th>长度</th><th>截面</th><th>温度</th><th>数量关系</th><th>单根电阻</th><th>折算电阻</th>${report ? '<th>附图</th>' : ''}</tr></thead><tbody>${result.segments.map((segment) => `<tr>
      <td><b>R${segment.index}</b><br>${esc(segment.item.name || '未命名')}</td><td>${esc(segment.material.name)}</td><td>${E.fmtExact(segment.lengthMm)} mm</td><td>${E.fmtExact(segment.areaMm2)} mm²<br>${E.fmtExact(segment.widthMm)}×${E.fmtExact(segment.heightMm)}</td><td>${E.fmtExact(segment.temperatureC)} °C</td><td>${segment.quantity} 根<br>${segment.item.quantityRelation === 'series' ? '串联 nR' : '并联 R/n'}</td><td>${resistanceText(segment.singleResistance)}</td><td><b>${resistanceText(segment.effectiveResistance)}</b></td>${report ? `<td>${segment.item.image ? `<img class="cd-report-image" src="${esc(segment.item.image.dataUrl)}" alt="${esc(segment.item.image.name)}">` : '—'}</td>` : ''}
    </tr>`).join('')}</tbody></table>`;
  }

  function conclusionHtml(result) {
    if (result.passed == null) return '<div class="status-banner warn">未设置总电阻上限，本次仅输出计算结果。</div>';
    return `<div class="status-banner ${result.passed ? 'ok' : 'err'}">校核结论：<b>${result.passed ? '合格' : '不合格'}</b>。组合总电阻 ${resistanceText(result.totalResistance)} ${result.passed ? '≤' : '>'} 上限 ${resistanceText(result.limitOhm)}。</div>`;
  }

  function calculateAndRender() {
    const box = hostRef.querySelector('#cdResult');
    try {
      const result = computeProject();
      const displayUnit = RESISTANCE_UNITS[state.displayUnit];
      box.innerHTML = `<h3 class="panel-title"><span class="dot"></span>校核结果</h3>${resultTable(result)}
        <div class="result-grid cd-result-grid"><div class="result-card"><div class="k">组合总电阻</div><div class="v">${E.fmtExact(result.totalResistance * displayUnit.factor, 6)}<small> ${displayUnit.label}</small></div></div><div class="result-card"><div class="k">组合总电导</div><div class="v">${E.fmtExact(1 / result.totalResistance, 6)}<small> S</small></div></div></div>
        <div class="note"><strong>组合表达式：</strong><code class="formula-line">${esc(state.expression)}</code></div>${conclusionHtml(result)}`;
    } catch (error) {
      box.innerHTML = `<h3 class="panel-title"><span class="dot"></span>校核结果</h3><div class="status-banner err">${esc(error.message)}</div>`;
    }
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const payload = { ...clone(state), exportedAt: new Date().toISOString(), calculator: 'conductor-resistance-check' };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `导体电阻校核_${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function importJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('JSON 文件不能超过 30 MB');
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.conductors) || !data.conductors.length) throw new Error('文件中没有导体段数据');
      const next = defaultState();
      next.displayUnit = RESISTANCE_UNITS[data.displayUnit] ? data.displayUnit : next.displayUnit;
      next.expression = typeof data.expression === 'string' ? data.expression : 'R1';
      next.limitValue = data.limitValue == null ? '' : data.limitValue;
      next.limitUnit = RESISTANCE_UNITS[data.limitUnit] ? data.limitUnit : next.limitUnit;
      next.conductors = data.conductors.map((item, index) => newConductor(index + 1, {
        name: item.name || `导体段 ${index + 1}`,
        material: MATERIALS[item.material] ? item.material : 'copper',
        lengthMm: item.lengthMm ?? 100,
        widthMm: item.widthMm ?? 5,
        heightMm: item.heightMm ?? 1,
        temperatureC: item.temperatureC ?? 20,
        quantity: item.quantity ?? 1,
        quantityRelation: item.quantityRelation === 'series' ? 'series' : 'parallel',
        image: item.image?.dataUrl ? item.image : null,
      }));
      state = next;
      render();
    } catch (error) {
      window.alert(`导入失败：${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  function clearProject() {
    if (!window.confirm('确认清空当前导体电阻校核吗？建议先导出 JSON 备份。')) return;
    state = defaultState();
    render();
  }

  function reportHtml(result) {
    const conclusion = result.passed == null ? '未设置限值，仅计算' : (result.passed ? '合格' : '不合格');
    return `<article class="cd-report"><header><h1>导体电阻校核报告</h1><p>生成时间：${new Date().toLocaleString('zh-CN')}</p></header>
      <section><h2>1. 校核设置</h2><table><tr><th>组合表达式</th><td>${esc(state.expression)}</td><th>显示单位</th><td>${RESISTANCE_UNITS[state.displayUnit].label}</td></tr><tr><th>总电阻上限</th><td>${result.limitOhm == null ? '未设置' : resistanceText(result.limitOhm)}</td><th>结论</th><td class="${result.passed === false ? 'fail' : 'pass'}">${conclusion}</td></tr></table></section>
      <section><h2>2. 导体段明细</h2>${resultTable(result, true)}</section>
      <section><h2>3. 计算结果</h2><p class="cd-report-total">组合总电阻：<b>${resistanceText(result.totalResistance)}</b></p><p>组合总电导：${E.fmtExact(1 / result.totalResistance, 6)} S</p><p>计算依据：R=ρ(T)×L/A；同规格导体按所选数量关系折算，再依表达式进行串并联组合。</p></section>
    </article>`;
  }

  function exportPdf() {
    let result;
    try { result = computeProject(); } catch (error) { window.alert(`无法生成报告：${error.message}`); return; }
    const shell = hostRef.querySelector('#cdReportShell');
    shell.innerHTML = reportHtml(result);
    shell.classList.add('active');
    const originalParent = shell.parentNode;
    const originalNextSibling = shell.nextSibling;
    document.body.appendChild(shell);
    const oldTitle = document.title;
    document.title = '导体电阻校核报告';
    const restore = () => {
      document.title = oldTitle;
      shell.classList.remove('active');
      originalParent.insertBefore(shell, originalNextSibling);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 150);
  }

  function moduleStyle() {
    return `
      .cd-toolbar,.cd-section-head{display:flex;justify-content:space-between;gap:18px;align-items:center}.cd-toolbar h3,.cd-toolbar p,.cd-section-head h3,.cd-section-head p{margin:3px 0}.cd-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.cd-file-btn{position:relative;overflow:hidden}.cd-file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}.cd-settings{display:grid;grid-template-columns:220px minmax(300px,420px) 1fr;gap:14px;align-items:end}.cd-settings>label{display:grid;gap:5px}.cd-settings>label>span{font-weight:700;font-size:12px}.cd-settings .input-row select{max-width:82px}.cd-table-scroll{overflow:auto;margin-top:12px}.cd-segment-head,.cd-segment-row{display:grid;grid-template-columns:58px minmax(150px,1.2fr) minmax(175px,1.3fr) 90px 80px 80px 90px 72px 125px 150px 40px;gap:7px;align-items:stretch;min-width:1270px}.cd-segment-head{padding:7px;background:#edf2f6;border:1px solid #c3cfda;font-size:12px;font-weight:700;text-align:center}.cd-segment-row{padding:7px;border:1px solid #d3dce4;border-top:0;background:#fff}.cd-segment-row input,.cd-segment-row select{width:100%;min-width:0}.cd-ref{display:flex;align-items:center;justify-content:center;background:#f0f5f8;border:1px solid #c8d3dc}.cd-row-image{display:grid;grid-template-columns:44px 1fr auto;gap:5px;align-items:center;min-width:0}.cd-row-image img{width:42px;height:38px;object-fit:contain;border:1px solid #ccd6df;background:#f5f7f9}.cd-row-image span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.cd-row-image button{border:0;background:none;color:#b42318;cursor:pointer;padding:2px}.cd-row-image .btn{grid-column:1/-1;font-size:12px;padding:7px}.cd-result-table{margin-top:10px}.cd-result-table th,.cd-result-table td{font-size:12px;vertical-align:top}.cd-result-grid{margin-top:12px}.cd-report-shell{display:none}.btn.danger{color:#b42318;border-color:#e2a7a7}
      @media(max-width:900px){.cd-toolbar,.cd-section-head{align-items:flex-start;flex-direction:column}.cd-actions{justify-content:flex-start}.cd-settings{grid-template-columns:1fr}}
      @media print{@page{size:A4 portrait;margin:12mm}html,body{min-height:0!important;height:auto!important;background:#fff!important}body>*:not(.cd-report-shell){display:none!important}.cd-report-shell.active{display:block!important;position:static!important;width:100%!important;background:#fff!important;color:#111!important}.cd-report{font-family:'Microsoft YaHei',Arial,sans-serif;font-size:9pt}.cd-report header{border-bottom:2px solid #173b5e;margin-bottom:10mm}.cd-report h1{font-size:20pt;margin:0 0 3mm}.cd-report h2{font-size:12pt;margin:7mm 0 2mm}.cd-report table{width:100%;border-collapse:collapse;table-layout:fixed}.cd-report th,.cd-report td{border:1px solid #777;padding:2mm;word-break:break-word}.cd-report th{background:#e9eef2}.cd-report .cd-result-table th,.cd-report .cd-result-table td{font-size:7.5pt}.cd-report-image{display:block;max-width:26mm;max-height:22mm;margin:auto}.cd-report-total{font-size:13pt}.cd-report .pass{color:#087b3b;font-weight:700}.cd-report .fail{color:#b42318;font-weight:700}}
    `;
  }

  T.register({
    id: 'conductor',
    title: '导体电阻',
    icon: '🧪',
    group: '电气计算',
    desc: '统一校核单段或多段导体，支持命名、数量串并联、附图、JSON 续填与 A4 PDF 报告。',
    render(host) {
      hostRef = host;
      state = defaultState();
      render();
    },
  });
})();
