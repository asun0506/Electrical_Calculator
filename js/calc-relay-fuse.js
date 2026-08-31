/**
 * 继电器 / 保险丝保护配合
 * - 电池包电压、等效内阻与最大外短电流
 * - 多导体段 / 定值电阻串并联组合
 * - 厂家时间-电流曲线录入、人工校核分析、JSON 与 A4 PDF 报告
 */
(function () {
  'use strict';

  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const PALETTE = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#64748b'];
  const MATERIALS = {
    copper: { name: '铜 Cu（退火）', rho: 1.72e-8, alpha: 0.00393 },
    copper_hard: { name: '铜 Cu（硬拉）', rho: 1.77e-8, alpha: 0.00393 },
    aluminum: { name: '铝 Al', rho: 2.82e-8, alpha: 0.00403 },
    brass: { name: '黄铜（60Cu40Zn）', rho: 6.5e-8, alpha: 0.0015 },
    steel: { name: '钢（低碳）', rho: 1.4e-7, alpha: 0.005 },
  };
  const RESISTANCE_UNITS = {
    ohm: { label: 'Ω', factor: 1 },
    mohm: { label: 'mΩ', factor: 1e3 },
    uohm: { label: 'μΩ', factor: 1e6 },
  };

  let hostRef;
  let batteryState;
  let curveSeq = 0;
  let colorIdx = 2;
  let componentSeq = 0;
  let lastBatteryResult = null;

  function esc(value) { return E.escapeHtml(value == null ? '' : String(value)); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function newComponent(index, overrides = {}) {
    componentSeq += 1;
    return {
      id: `rf_component_${Date.now()}_${componentSeq}`,
      name: `电阻段 ${index}`,
      method: 'geometry',
      material: 'copper',
      lengthMm: 100,
      widthMm: 20,
      heightMm: 1,
      temperatureC: 20,
      fixedValue: 0.3,
      fixedUnit: 'mohm',
      quantity: 1,
      quantityRelation: 'series',
      ...overrides,
    };
  }

  function defaultBatteryState() {
    return {
      voltageV: 400,
      resistanceMode: 'segments',
      directResistance: 30,
      directUnit: 'mohm',
      displayUnit: 'mohm',
      expression: 'R1 + R2 + R3',
      components: [
        newComponent(1, { name: '电芯内阻', method: 'fixed', fixedValue: 0.3, fixedUnit: 'mohm', quantity: 96, quantityRelation: 'series' }),
        newComponent(2, { name: '模组巴片', lengthMm: 80, widthMm: 20, heightMm: 1, quantity: 12, quantityRelation: 'series' }),
        newComponent(3, { name: 'Pack 主母排', lengthMm: 500, widthMm: 30, heightMm: 3, quantity: 2, quantityRelation: 'series' }),
      ],
    };
  }

  function materialOptions(selected) {
    return Object.entries(MATERIALS).map(([key, item]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${item.name}</option>`).join('');
  }

  function unitOptions(selected) {
    return Object.entries(RESISTANCE_UNITS).map(([key, item]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${item.label}</option>`).join('');
  }

  function componentRow(item, index) {
    const geometryInput = item.method === 'geometry';
    return `<div class="rf-res-row" data-component-id="${esc(item.id)}">
      <div class="rf-res-ref"><b>R${index + 1}</b></div>
      <input data-field="name" value="${esc(item.name)}" aria-label="R${index + 1} 名称">
      <select data-field="method" aria-label="电阻取得方式"><option value="geometry" ${geometryInput ? 'selected' : ''}>尺寸计算</option><option value="fixed" ${!geometryInput ? 'selected' : ''}>定值电阻</option></select>
      <div class="rf-res-source">${geometryInput
        ? `<select data-field="material" aria-label="材质">${materialOptions(item.material)}</select>`
        : `<div class="input-row"><input data-field="fixedValue" type="number" min="0" step="any" value="${esc(item.fixedValue)}" aria-label="定值电阻"><select data-field="fixedUnit">${unitOptions(item.fixedUnit)}</select></div>`}</div>
      <input data-field="lengthMm" type="number" min="0" step="any" value="${esc(item.lengthMm)}" aria-label="长度 mm" ${geometryInput ? '' : 'disabled'}>
      <input data-field="widthMm" type="number" min="0" step="any" value="${esc(item.widthMm)}" aria-label="宽度 mm" ${geometryInput ? '' : 'disabled'}>
      <input data-field="heightMm" type="number" min="0" step="any" value="${esc(item.heightMm)}" aria-label="厚度 mm" ${geometryInput ? '' : 'disabled'}>
      <input data-field="temperatureC" type="number" step="any" value="${esc(item.temperatureC)}" aria-label="温度 °C" ${geometryInput ? '' : 'disabled'}>
      <input data-field="quantity" type="number" min="1" step="1" value="${esc(item.quantity)}" aria-label="数量">
      <select data-field="quantityRelation" aria-label="同规格关系"><option value="series" ${item.quantityRelation === 'series' ? 'selected' : ''}>串联 nR</option><option value="parallel" ${item.quantityRelation === 'parallel' ? 'selected' : ''}>并联 R/n</option></select>
      <button type="button" class="row-del" data-delete-component="${esc(item.id)}" ${batteryState.components.length === 1 ? 'disabled' : ''}>✕</button>
    </div>`;
  }

  function renderModule(host) {
    hostRef = host;
    batteryState = defaultBatteryState();
    curveSeq = 0;
    colorIdx = 2;
    host.innerHTML = `<style>${moduleStyle()}</style>
      <section class="panel rf-toolbar">
        <div><h3>电池包外短与保护配合校核</h3><p>先计算电池包等效内阻和最大外短电流，再用厂家时间-电流曲线进行人工配合分析。</p></div>
        <div class="rf-actions"><button type="button" class="btn" id="cc-export">导出 JSON</button><label class="btn rf-file-btn">导入 JSON<input type="file" id="cc-file" accept=".json,application/json"></label><button type="button" class="btn btn-primary" id="rf-export-pdf">打印 / 导出 PDF</button><button type="button" class="btn" id="rf-export-pdf-en">导出英文 PDF</button></div>
      </section>

      <section class="panel">
        <h3 class="panel-title"><span class="dot"></span>① 电池包信息与最大外短电流</h3>
        <div class="rf-pack-settings">
          <label><span>电池包电压</span><div class="input-row"><input id="rf-pack-voltage" type="number" min="0" step="any" value="${batteryState.voltageV}"><span class="unit">V</span></div></label>
          <label><span>整包电阻取得方式</span><select id="rf-pack-mode"><option value="segments">导体段 / 电芯组合计算</option><option value="direct">直接输入整包定值电阻</option></select></label>
          <label><span>结果显示单位</span><select id="rf-display-unit">${unitOptions(batteryState.displayUnit)}</select></label>
        </div>
        <div id="rf-direct-box" class="rf-direct-box" hidden><label>整包定值电阻</label><div class="input-row"><input id="rf-direct-resistance" type="number" min="0" step="any" value="${batteryState.directResistance}"><select id="rf-direct-unit">${unitOptions(batteryState.directUnit)}</select></div></div>
        <div id="rf-segment-box">
          <div class="rf-section-head"><div><h4>电阻组成</h4><p>尺寸计算采用 R=ρ(T)L/A；电芯内阻、接触电阻等可选择“定值电阻”。</p></div><button type="button" class="btn" id="rf-add-component">＋ 添加电阻段</button></div>
          <div class="rf-res-scroll"><div class="rf-res-head"><span>引用</span><span>名称</span><span>方式</span><span>材质 / 定值</span><span>长度/mm</span><span>宽/mm</span><span>厚/mm</span><span>温度/°C</span><span>数量</span><span>同规格关系</span><span></span></div><div id="rf-battery-rows"></div></div>
          <div class="field rf-expression"><label>组合表达式 <span class="hint">+ 表示串联，// 表示并联，可使用括号</span></label><input id="rf-expression" value="${esc(batteryState.expression)}" spellcheck="false"><div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" id="rf-all-series">全部串联</button><button type="button" class="btn btn-ghost btn-sm" id="rf-all-parallel">全部并联</button></div></div>
        </div>
        <div id="rf-battery-result"></div>
      </section>

      <section class="panel">
        <h3 class="panel-title"><span class="dot"></span>② 数据点曲线表</h3>
        <p class="rf-muted">为保险丝、继电器/接触器、电芯、线束等输入厂家数据点 <b>(电流 I/A，动作或耐受时间 t/s)</b>，同一曲线建议不少于 2 个点。</p>
        <div id="cc-curves"></div>
        <div class="btn-row"><button class="btn btn-ghost" id="cc-add-curve">＋ 添加曲线</button><button class="btn btn-primary" id="cc-gen">生成图表</button></div>
      </section>

      <section class="panel">
        <h3 class="panel-title"><span class="dot"></span>③ 保护配合曲线与校核分析</h3>
        <div class="chart-title-input"><label>图表名称</label><input id="cc-title" type="text" value="保护配合曲线（时间-电流）"></div>
        <div class="range-bar"><div class="range-item"><label>X 电流范围 (A)</label><input id="cc-xmin" type="number" step="any" placeholder="自动"><span class="range-sep">～</span><input id="cc-xmax" type="number" step="any" placeholder="自动"></div><div class="range-item"><label>Y 时间范围 (s)</label><input id="cc-ymin" type="number" step="any" placeholder="自动"><span class="range-sep">～</span><input id="cc-ymax" type="number" step="any" placeholder="自动"></div><button class="btn btn-ghost btn-sm" id="cc-reset-range" type="button">重置为自动</button></div>
        <div id="cc-chart"></div>
        <label class="rf-analysis"><span>校核分析（用户填写）</span><textarea id="rf-analysis" rows="7" placeholder="请结合曲线填写：最大外短电流位置、保险丝动作时间、接触器/线束/电芯耐受裕量、选择性保护关系、异常风险及最终意见。"></textarea><small>此内容将随 JSON 保存，并写入 PDF 校核报告。</small></label>
      </section>
      <section class="rf-report-shell" id="rf-report-shell"></section>`;

    renderBatteryRows();
    addCurve('继电器触点耐受', PALETTE[1], [[300, 10], [600, 2], [1000, 0.5], [2000, 0.1], [5000, 0.02]]);
    addCurve('保险丝熔断', PALETTE[0], [[300, 30], [600, 5], [1000, 1], [2000, 0.2], [5000, 0.03]]);
    addCurve('线束发烟极限', PALETTE[2], [[200, 100], [500, 20], [1000, 5], [3000, 0.8], [8000, 0.1]]);
    addCurve('电芯热失控边界', PALETTE[3], [[500, 300], [1000, 80], [3000, 15], [8000, 2], [15000, 0.5]]);
    bindStaticEvents();
    updateBattery();
  }

  function bindStaticEvents() {
    hostRef.querySelector('#rf-pack-voltage').addEventListener('input', (event) => { batteryState.voltageV = event.target.value; updateBattery(); });
    hostRef.querySelector('#rf-pack-mode').addEventListener('change', (event) => { batteryState.resistanceMode = event.target.value; toggleBatteryMode(); updateBattery(); });
    hostRef.querySelector('#rf-display-unit').addEventListener('change', (event) => { batteryState.displayUnit = event.target.value; updateBattery(); });
    hostRef.querySelector('#rf-direct-resistance').addEventListener('input', (event) => { batteryState.directResistance = event.target.value; updateBattery(); });
    hostRef.querySelector('#rf-direct-unit').addEventListener('change', (event) => { batteryState.directUnit = event.target.value; updateBattery(); });
    hostRef.querySelector('#rf-expression').addEventListener('input', (event) => { batteryState.expression = event.target.value; updateBattery(); });
    hostRef.querySelector('#rf-add-component').addEventListener('click', () => { batteryState.components.push(newComponent(batteryState.components.length + 1)); batteryState.expression = allExpression('+'); renderBatteryRows(); updateBattery(); });
    hostRef.querySelector('#rf-all-series').addEventListener('click', () => setAllExpression('+'));
    hostRef.querySelector('#rf-all-parallel').addEventListener('click', () => setAllExpression('//'));
    hostRef.querySelector('#cc-add-curve').addEventListener('click', () => addCurve(`曲线 ${curveSeq}`, nextColor()));
    hostRef.querySelector('#cc-gen').addEventListener('click', renderChart);
    ['cc-xmin', 'cc-xmax', 'cc-ymin', 'cc-ymax', 'cc-title'].forEach((id) => hostRef.querySelector(`#${id}`).addEventListener('input', renderChart));
    hostRef.querySelector('#cc-reset-range').addEventListener('click', () => { ['cc-xmin', 'cc-xmax', 'cc-ymin', 'cc-ymax'].forEach((id) => { hostRef.querySelector(`#${id}`).value = ''; }); renderChart(); });
    hostRef.querySelector('#cc-export').addEventListener('click', exportData);
    hostRef.querySelector('#cc-file').addEventListener('change', (event) => { importData(event.target.files?.[0]); event.target.value = ''; });
    hostRef.querySelector('#rf-export-pdf').addEventListener('click', () => exportPdf());
    hostRef.querySelector('#rf-export-pdf-en').addEventListener('click', () => exportPdf('en'));
  }

  function toggleBatteryMode() {
    hostRef.querySelector('#rf-direct-box').hidden = batteryState.resistanceMode !== 'direct';
    hostRef.querySelector('#rf-segment-box').hidden = batteryState.resistanceMode !== 'segments';
  }

  function renderBatteryRows() {
    const rows = hostRef.querySelector('#rf-battery-rows');
    rows.innerHTML = batteryState.components.map(componentRow).join('');
    hostRef.querySelector('#rf-expression').value = batteryState.expression;
    rows.querySelectorAll('[data-component-id] input[data-field], [data-component-id] select[data-field]').forEach((control) => control.addEventListener('input', handleComponentInput));
    rows.querySelectorAll('[data-delete-component]').forEach((button) => button.addEventListener('click', () => {
      if (batteryState.components.length <= 1) return;
      batteryState.components = batteryState.components.filter((item) => item.id !== button.dataset.deleteComponent);
      batteryState.expression = allExpression('+');
      renderBatteryRows();
      updateBattery();
    }));
  }

  function handleComponentInput(event) {
    const row = event.target.closest('[data-component-id]');
    const item = batteryState.components.find((entry) => entry.id === row.dataset.componentId);
    if (!item) return;
    item[event.target.dataset.field] = event.target.value;
    if (event.target.dataset.field === 'method') renderBatteryRows();
    updateBattery();
  }

  function allExpression(operator) { return batteryState.components.map((item, index) => `R${index + 1}`).join(` ${operator} `); }
  function setAllExpression(operator) { batteryState.expression = allExpression(operator); hostRef.querySelector('#rf-expression').value = batteryState.expression; updateBattery(); }

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
      if (token === '(') { position += 1; const value = parseExpression(); if (tokens[position] !== ')') throw new Error('缺少右括号 )'); position += 1; return value; }
      if (typeof token === 'number') { position += 1; return token; }
      if (typeof token === 'string' && /^R\d+$/.test(token)) { position += 1; const number = Number(token.slice(1)); if (!(number in resistanceMap)) throw new Error(`电阻段 R${number} 未定义`); return resistanceMap[number]; }
      throw new Error(`表达式错误（${token == null ? '末尾' : token}附近）`);
    }
    function parseExpression() {
      let value = parseTerm();
      while (position < tokens.length && ['+', '//'].includes(tokens[position])) { const operator = tokens[position++]; const right = parseTerm(); value = operator === '+' ? value + right : (value * right) / (value + right); }
      return value;
    }
    const result = parseExpression();
    if (position !== tokens.length) throw new Error('表达式存在多余内容');
    return result;
  }

  function computeBattery() {
    const voltageV = E.parseNum(batteryState.voltageV);
    if (voltageV == null || voltageV <= 0) throw new Error('电池包电压必须大于 0');
    if (batteryState.resistanceMode === 'direct') {
      const input = E.parseNum(batteryState.directResistance);
      if (input == null || input <= 0) throw new Error('整包定值电阻必须大于 0');
      const totalResistance = input / RESISTANCE_UNITS[batteryState.directUnit].factor;
      return { voltageV, totalResistance, shortCircuitCurrent: voltageV / totalResistance, segments: [], mode: 'direct' };
    }
    const resistanceMap = {};
    const segments = batteryState.components.map((item, index) => {
      const quantity = E.parseNum(item.quantity);
      if (quantity == null || quantity < 1 || !Number.isInteger(quantity)) throw new Error(`R${index + 1} 数量必须是大于等于 1 的整数`);
      let singleResistance;
      let detail;
      if (item.method === 'fixed') {
        const value = E.parseNum(item.fixedValue);
        if (value == null || value <= 0) throw new Error(`R${index + 1} 定值电阻必须大于 0`);
        singleResistance = value / RESISTANCE_UNITS[item.fixedUnit].factor;
        detail = `定值 ${value} ${RESISTANCE_UNITS[item.fixedUnit].label}`;
      } else {
        const material = MATERIALS[item.material];
        const lengthMm = E.parseNum(item.lengthMm);
        const widthMm = E.parseNum(item.widthMm);
        const heightMm = E.parseNum(item.heightMm);
        const temperatureC = E.parseNum(item.temperatureC);
        if (!material || [lengthMm, widthMm, heightMm, temperatureC].some((value) => value == null)) throw new Error(`R${index + 1} 尺寸参数未填写完整`);
        if (lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) throw new Error(`R${index + 1} 长度、宽度和厚度必须大于 0`);
        const rhoT = material.rho * (1 + material.alpha * (temperatureC - 20));
        if (rhoT <= 0) throw new Error(`R${index + 1} 温度修正后的电阻率无效`);
        singleResistance = rhoT * (lengthMm / 1000) / ((widthMm * heightMm) / 1e6);
        detail = `${material.name}；${lengthMm}×${widthMm}×${heightMm} mm；${temperatureC} °C`;
      }
      const effectiveResistance = item.quantityRelation === 'series' ? singleResistance * quantity : singleResistance / quantity;
      resistanceMap[index + 1] = effectiveResistance;
      return { index: index + 1, item, quantity, singleResistance, effectiveResistance, detail };
    });
    const expression = String(batteryState.expression || '').trim();
    if (!expression) throw new Error('请填写电阻段组合表达式');
    const totalResistance = evaluateExpression(tokenize(expression), resistanceMap);
    if (!Number.isFinite(totalResistance) || totalResistance <= 0) throw new Error('整包组合电阻无效');
    return { voltageV, totalResistance, shortCircuitCurrent: voltageV / totalResistance, segments, mode: 'segments' };
  }

  function resistanceText(value, unitKey = batteryState.displayUnit) { const unit = RESISTANCE_UNITS[unitKey]; return `${E.fmtExact(value * unit.factor, 6)} ${unit.label}`; }

  function updateBattery() {
    const box = hostRef.querySelector('#rf-battery-result');
    toggleBatteryMode();
    try {
      lastBatteryResult = computeBattery();
      const rows = lastBatteryResult.segments.length ? `<table class="param-table rf-result-table"><thead><tr><th>引用 / 名称</th><th>取得方式</th><th>单个电阻</th><th>数量关系</th><th>折算电阻</th></tr></thead><tbody>${lastBatteryResult.segments.map((segment) => `<tr><td><b>R${segment.index}</b><br>${esc(segment.item.name)}</td><td>${esc(segment.detail)}</td><td>${resistanceText(segment.singleResistance)}</td><td>${segment.quantity} 个，${segment.item.quantityRelation === 'series' ? '串联 nR' : '并联 R/n'}</td><td><b>${resistanceText(segment.effectiveResistance)}</b></td></tr>`).join('')}</tbody></table>` : '';
      box.innerHTML = `${rows}<div class="result-grid"><div class="result-card"><div class="k">电池包电压</div><div class="v">${E.fmtExact(lastBatteryResult.voltageV, 6)}<small> V</small></div></div><div class="result-card"><div class="k">整包等效电阻</div><div class="v">${resistanceText(lastBatteryResult.totalResistance)}</div></div><div class="result-card"><div class="k">最大外短电流 I<sub>sc,max</sub></div><div class="v">${E.fmtExact(lastBatteryResult.shortCircuitCurrent, 3)}<small> A</small></div></div></div><div class="status-banner warn"><b>计算边界：</b>I<sub>sc,max</sub>=U<sub>pack</sub>/R<sub>pack</sub>。该值未计电芯电压塌陷、电弧阻抗、SOC/温度离散及动态极化，仅作为理想初始外短电流上限参考。</div>`;
    } catch (error) {
      lastBatteryResult = null;
      box.innerHTML = `<div class="status-banner err">${esc(error.message)}</div>`;
    }
    if (hostRef.querySelector('#cc-chart')) renderChart();
  }

  function nextColor() { return PALETTE[colorIdx++ % PALETTE.length]; }

  function addCurve(name, color, points) {
    const wrap = hostRef.querySelector('#cc-curves');
    const div = document.createElement('div');
    div.className = 'curve-block';
    div.dataset.seq = curveSeq++;
    const paletteOptions = PALETTE.map((item) => `<option value="${item}" ${item === color ? 'selected' : ''} style="background:${item}">${item}</option>`).join('');
    div.innerHTML = `<div class="curve-head"><input type="text" class="cc-name" value="${esc(name)}" placeholder="设备 / 曲线名称"><select class="cc-color">${paletteOptions}</select><span class="curve-point-count">0 点</span><button class="btn btn-ghost btn-sm btn-add-pt" type="button">＋ 点</button><button class="btn btn-ghost btn-sm btn-paste" type="button">批量粘贴</button><button class="btn btn-ghost btn-sm btn-del" type="button">删除</button></div><div class="curve-points"></div><div class="paste-box" style="display:none"><div class="paste-actions"><span class="paste-hint">从 Excel 复制电流 I 与时间 t 两列；支持制表符、逗号或空格分隔。</span><button class="btn btn-ghost btn-sm" data-mode="overwrite" type="button">导入（覆盖）</button><button class="btn btn-ghost btn-sm" data-mode="append" type="button">导入（追加）</button></div><textarea class="paste-ta" rows="5" placeholder="20&#9;1&#10;40&#9;0.25&#10;100&#9;0.04"></textarea></div>`;
    const pointsBox = div.querySelector('.curve-points');
    (points || []).forEach(([current, time]) => addPoint(pointsBox, current, time));
    if (!points?.length) addPoint(pointsBox, 10, 1);
    div.querySelector('.btn-add-pt').addEventListener('click', () => addPoint(pointsBox, '', ''));
    div.querySelector('.btn-paste').addEventListener('click', () => { const box = div.querySelector('.paste-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; });
    div.querySelector('.btn-del').addEventListener('click', () => { if (wrap.querySelectorAll('.curve-block').length > 1) div.remove(); else div.querySelector('.cc-name').value = ''; renderChart(); });
    div.querySelectorAll('.paste-box .btn').forEach((button) => button.addEventListener('click', () => { const parsed = parsePasted(div.querySelector('.paste-ta').value); if (!parsed.length) return; if (button.dataset.mode === 'overwrite') pointsBox.innerHTML = ''; parsed.forEach(([current, time]) => addPoint(pointsBox, current, time)); div.querySelector('.paste-ta').value = ''; renderChart(); }));
    div.querySelectorAll('.cc-name,.cc-color').forEach((control) => control.addEventListener('input', renderChart));
    wrap.appendChild(div);
  }

  function parsePasted(text) {
    const points = [];
    String(text).split(/\r?\n/).forEach((line) => {
      const value = line.trim();
      if (!value) return;
      const parts = (value.includes('\t') ? value.split('\t') : /[,，;；]/.test(value) ? value.split(/[,，;；]/) : value.split(/\s+/)).map((item) => item.trim()).filter(Boolean);
      const current = E.parseNum(parts[0]);
      const time = E.parseNum(parts[1]);
      if (current != null && time != null && current > 0 && time > 0) points.push([current, time]);
    });
    return points;
  }

  function addPoint(pointsBox, current, time) {
    const row = document.createElement('div');
    row.className = 'pt-row';
    row.innerHTML = `<input type="number" class="pt-i" value="${current === '' ? '' : E.fmtExact(current)}" placeholder="电流 I (A)" step="any" min="0"><input type="number" class="pt-t" value="${time === '' ? '' : E.fmtExact(time)}" placeholder="时间 t (s)" step="any" min="0"><button class="pt-del" type="button">✕</button>`;
    row.querySelector('.pt-del').addEventListener('click', () => { if (pointsBox.children.length > 1) row.remove(); else { row.querySelector('.pt-i').value = ''; row.querySelector('.pt-t').value = ''; } updateCount(pointsBox); renderChart(); });
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', renderChart));
    pointsBox.appendChild(row);
    updateCount(pointsBox);
  }

  function updateCount(pointsBox) { const count = pointsBox.closest('.curve-block').querySelector('.curve-point-count'); if (count) count.textContent = `${pointsBox.querySelectorAll('.pt-row').length} 点`; }

  function collectCurves() {
    return Array.from(hostRef.querySelectorAll('#cc-curves .curve-block')).map((block) => ({
      name: block.querySelector('.cc-name').value.trim() || '未命名曲线',
      color: block.querySelector('.cc-color').value,
      points: Array.from(block.querySelectorAll('.pt-row')).map((row) => [E.parseNum(row.querySelector('.pt-i').value), E.parseNum(row.querySelector('.pt-t').value)]).filter(([current, time]) => current != null && time != null && current > 0 && time > 0),
    }));
  }

  function renderChart(lang = 'zh', reportOnly = false) {
    const r = T.reportLanguage(lang);
    const chart = hostRef?.querySelector('#cc-chart');
    if (!chart) return;
    const valid = collectCurves().filter((curve) => curve.points.length);
    if (!valid.length) {
      const empty = r('<div class="empty-tip">请至少输入一条有效曲线。</div>');
      if (!reportOnly) chart.innerHTML = empty;
      return empty;
    }
    let minX = Infinity, maxX = 0, minY = Infinity, maxY = 0;
    valid.forEach((curve) => curve.points.forEach(([current, time]) => { minX = Math.min(minX, current); maxX = Math.max(maxX, current); minY = Math.min(minY, time); maxY = Math.max(maxY, time); }));
    if (lastBatteryResult) maxX = Math.max(maxX, lastBatteryResult.shortCircuitCurrent);
    if (minX === maxX) maxX = minX * 10;
    if (minY === maxY) maxY = minY * 100;
    const ranges = { xmin: E.parseNum(hostRef.querySelector('#cc-xmin').value), xmax: E.parseNum(hostRef.querySelector('#cc-xmax').value), ymin: E.parseNum(hostRef.querySelector('#cc-ymin').value), ymax: E.parseNum(hostRef.querySelector('#cc-ymax').value) };
    let xMin = ranges.xmin > 0 ? ranges.xmin : Math.pow(10, Math.floor(Math.log10(minX)) - 0.4);
    let xMax = ranges.xmax > 0 ? ranges.xmax : Math.pow(10, Math.ceil(Math.log10(maxX)) + 0.2);
    let yMin = ranges.ymin > 0 ? ranges.ymin : Math.pow(10, Math.floor(Math.log10(minY)) - 0.3);
    let yMax = ranges.ymax > 0 ? ranges.ymax : Math.pow(10, Math.ceil(Math.log10(maxY)) + 0.3);
    if (xMin >= xMax) [xMin, xMax] = [xMax, xMin];
    if (yMin >= yMax) [yMin, yMax] = [yMax, yMin];
    const vLines = lastBatteryResult ? [{ x: lastBatteryResult.shortCircuitCurrent, color: '#64748b', label: r`最大外短电流 ${E.fmtExact(lastBatteryResult.shortCircuitCurrent, 1)} A`, dash: true }] : [];
    const title = hostRef.querySelector('#cc-title').value.trim();
    const html = T.chart({ width: 780, height: 460, title: title === '保护配合曲线（时间-电流）' ? r(title) : title, x: { min: xMin, max: xMax, label: r('电流 I'), unit: 'A' }, y: { min: yMin, max: yMax, label: r('时间 t'), unit: 's' }, series: valid, vLines });
    if (!reportOnly) chart.innerHTML = html;
    return html;
  }

  function collectAll() {
    return { version: 2, type: 'relay-fuse', savedAt: new Date().toISOString(), battery: clone(batteryState), curves: collectCurves(), title: hostRef.querySelector('#cc-title').value, analysis: hostRef.querySelector('#rf-analysis').value, range: { xmin: hostRef.querySelector('#cc-xmin').value, xmax: hostRef.querySelector('#cc-xmax').value, ymin: hostRef.querySelector('#cc-ymin').value, ymax: hostRef.querySelector('#cc-ymax').value } };
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportData() { downloadBlob(new Blob([JSON.stringify(collectAll(), null, 2)], { type: 'application/json' }), `电池包保护配合校核_${new Date().toISOString().slice(0, 10)}.json`); }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(reader.result); if (!data || data.type !== 'relay-fuse') throw new Error('type 不匹配'); applyAll(data); } catch (error) { window.alert(`导入失败：${error.message}`); } };
    reader.readAsText(file);
  }

  function normalizeImportedBattery(source, legacyShortCircuit) {
    if (source?.components?.length) { const next = { ...defaultBatteryState(), ...source }; next.components = source.components.map((item, index) => newComponent(index + 1, item)); return next; }
    const next = defaultBatteryState();
    if (legacyShortCircuit > 0) { next.resistanceMode = 'direct'; next.directUnit = 'mohm'; next.directResistance = next.voltageV / legacyShortCircuit * 1000; }
    return next;
  }

  function applyAll(data) {
    batteryState = normalizeImportedBattery(data.battery, data.shortCircuit);
    hostRef.querySelector('#rf-pack-voltage').value = batteryState.voltageV;
    hostRef.querySelector('#rf-pack-mode').value = batteryState.resistanceMode;
    hostRef.querySelector('#rf-display-unit').value = batteryState.displayUnit;
    hostRef.querySelector('#rf-direct-resistance').value = batteryState.directResistance;
    hostRef.querySelector('#rf-direct-unit').value = batteryState.directUnit;
    renderBatteryRows();
    const wrap = hostRef.querySelector('#cc-curves');
    wrap.innerHTML = '';
    curveSeq = 0;
    colorIdx = 0;
    (data.curves?.length ? data.curves : [{ name: '曲线 1', color: PALETTE[0], points: [] }]).forEach((curve) => addCurve(curve.name, curve.color, curve.points || []));
    hostRef.querySelector('#cc-title').value = data.title ?? '保护配合曲线（时间-电流）';
    hostRef.querySelector('#rf-analysis').value = data.analysis || '';
    const range = data.range || {};
    ['xmin', 'xmax', 'ymin', 'ymax'].forEach((key) => { hostRef.querySelector(`#cc-${key}`).value = range[key] || ''; });
    updateBattery();
  }

  function reportSegmentRows(result, lang = 'zh') {
    const r = T.reportLanguage(lang);
    if (!result.segments.length) return r('<tr><td colspan="6">整包电阻采用直接输入定值。</td></tr>');
    return result.segments.map((segment) => `<tr><td>R${segment.index}<br>${esc(segment.item.name)}</td><td>${esc(r(segment.detail))}</td><td>${resistanceText(segment.singleResistance)}</td><td>${segment.quantity}</td><td>${r(segment.item.quantityRelation === 'series' ? '串联 nR' : '并联 R/n')}</td><td>${resistanceText(segment.effectiveResistance)}</td></tr>`).join('');
  }

  function reportHtml(result, lang = 'zh') {
    const r = T.reportLanguage(lang);
    const analysis = hostRef.querySelector('#rf-analysis').value.trim();
    const chart = renderChart(lang, true);
    const curveRows = collectCurves().map((curve) => { const currents = curve.points.map((point) => point[0]); const times = curve.points.map((point) => point[1]); return `<tr><td>${esc(curve.name)}</td><td>${curve.points.length}</td><td>${currents.length ? `${Math.min(...currents)}～${Math.max(...currents)} A` : '—'}</td><td>${times.length ? `${Math.min(...times)}～${Math.max(...times)} s` : '—'}</td></tr>`; }).join('');
    return r`<article class="rf-report" lang="${lang}">
      <section class="rf-report-page"><header><h1>电池包外短与继电器/保险丝保护配合校核报告</h1><p>生成时间：${new Date().toLocaleString(lang === 'en' ? 'en-GB' : 'zh-CN')}</p></header>
        <h2>1. 电池包计算</h2><table><tr><th>电池包电压</th><td>${E.fmtExact(result.voltageV, 6)} V</td><th>整包等效电阻</th><td>${resistanceText(result.totalResistance)}</td><th>最大外短电流</th><td><b>${E.fmtExact(result.shortCircuitCurrent, 3)} A</b></td></tr></table>
        <h2>2. 电阻组成</h2><table class="rf-report-components"><thead><tr><th>引用 / 名称</th><th>取得方式 / 参数</th><th>单个电阻</th><th>数量</th><th>关系</th><th>折算电阻</th></tr></thead><tbody>${reportSegmentRows(result, lang)}</tbody></table>
        <p><b>组合表达式：</b>${result.mode === 'segments' ? esc(batteryState.expression) : r('直接输入整包定值电阻')}</p>
      </section>
      <section class="rf-report-page"><h2>3. 保护配合曲线</h2><div class="rf-report-chart">${chart}</div></section>
      <section class="rf-report-page">${analysis ? r`<h2>4. 人工校核分析</h2><div class="rf-report-analysis">${esc(analysis)}</div>` : ''}
        <h2>${analysis ? '5' : '4'}. 曲线数据摘要</h2><table><thead><tr><th>曲线名称</th><th>数据点数量</th><th>电流范围</th><th>时间范围</th></tr></thead><tbody>${curveRows}</tbody></table>
      </section></article>`;
  }

  function exportPdf(lang = 'zh') {
    let result;
    try { result = computeBattery(); } catch (error) { window.alert(`无法生成报告：${error.message}`); return; }
    renderChart();
    const shell = hostRef.querySelector('#rf-report-shell');
    shell.innerHTML = reportHtml(result, lang);
    shell.classList.add('active');
    const originalParent = shell.parentNode;
    const originalNextSibling = shell.nextSibling;
    document.body.appendChild(shell);
    const oldTitle = document.title;
    document.title = T.reportLanguage(lang)('电池包保护配合校核报告');
    const restore = () => { document.title = oldTitle; shell.classList.remove('active'); originalParent.insertBefore(shell, originalNextSibling); window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    setTimeout(() => window.print(), 150);
  }

  function moduleStyle() {
    return `.rf-toolbar,.rf-section-head{display:flex;justify-content:space-between;gap:18px;align-items:center}.rf-toolbar h3,.rf-toolbar p,.rf-section-head h4,.rf-section-head p{margin:3px 0}.rf-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.rf-file-btn{position:relative;overflow:hidden}.rf-file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}.rf-pack-settings{display:grid;grid-template-columns:1fr 1.35fr 1fr;gap:14px;align-items:end}.rf-pack-settings>label{display:grid;gap:5px}.rf-pack-settings>label>span{font-size:12px;font-weight:700}.rf-direct-box{max-width:460px;margin-top:14px}.rf-direct-box label{display:block;font-size:12px;font-weight:700;margin-bottom:5px}.rf-res-scroll{overflow:auto;margin-top:12px}.rf-res-head,.rf-res-row{display:grid;grid-template-columns:54px minmax(140px,1.1fr) 105px minmax(180px,1.3fr) 82px 76px 76px 88px 68px 115px 38px;gap:7px;min-width:1240px;align-items:stretch}.rf-res-head{padding:7px;background:#edf2f6;border:1px solid #c3cfda;font-size:12px;font-weight:700;text-align:center}.rf-res-row{padding:7px;border:1px solid #d3dce4;border-top:0;background:#fff}.rf-res-row input,.rf-res-row select{width:100%;min-width:0}.rf-res-ref{display:flex;align-items:center;justify-content:center;background:#f0f5f8;border:1px solid #c8d3dc}.rf-res-source .input-row select{max-width:72px}.rf-expression{margin-top:14px}.rf-muted{margin:0 0 10px;color:var(--text-muted);font-size:13px}.rf-result-table{margin-top:14px}.rf-result-table th,.rf-result-table td{font-size:12px}.rf-analysis{display:grid;gap:6px;margin-top:18px}.rf-analysis>span{font-weight:700}.rf-analysis textarea{min-height:130px;resize:vertical}.rf-analysis small{color:var(--text-muted)}.rf-report-shell{display:none}
    @media(max-width:900px){.rf-toolbar,.rf-section-head{align-items:flex-start;flex-direction:column}.rf-actions{justify-content:flex-start}.rf-pack-settings{grid-template-columns:1fr}}
    @media print{@page{size:A4 landscape;margin:10mm}html,body{min-height:0!important;height:auto!important;background:#fff!important}body>*:not(.rf-report-shell){display:none!important}.rf-report-shell.active{display:block!important;position:static!important;width:100%!important;background:#fff!important;color:#111!important}.rf-report{font-family:'Microsoft YaHei',Arial,sans-serif;font-size:8.5pt}.rf-report-page{break-after:page;page-break-after:always}.rf-report-page:last-child{break-after:auto;page-break-after:auto}.rf-report header{border-bottom:2px solid #173b5e;margin-bottom:7mm}.rf-report h1{font-size:18pt;margin:0 0 2mm}.rf-report h2{font-size:11.5pt;margin:5mm 0 2mm}.rf-report table{width:100%;border-collapse:collapse;table-layout:fixed}.rf-report th,.rf-report td{border:1px solid #777;padding:1.6mm;word-break:break-word}.rf-report th{background:#e9eef2}.rf-report-components th:nth-child(2){width:34%}.rf-report-warning{margin-top:4mm;padding:3mm;border-left:3px solid #b7791f;background:#fff8e6}.rf-report-chart svg{max-height:125mm}.rf-report-chart .note{font-size:8pt}.rf-report-analysis{min-height:25mm;padding:3mm;border:1px solid #999;white-space:pre-wrap}.rf-report .chart-legend{font-size:8pt}}
    `;
  }

  T.register({ id: 'relay-fuse', title: '继电器 / 保险丝匹配', icon: '🔌', group: '电气计算', desc: '计算电池包等效内阻与最大外短电流，录入厂家保护曲线并输出人工校核分析及 PDF 报告。', render: renderModule,
    captureDraft() {
      const data = collectAll();
      delete data.savedAt;
      // Unlike exported valid points, drafts must retain empty/half-filled rows too.
      data.curves = Array.from(hostRef.querySelectorAll('#cc-curves .curve-block')).map((block) => ({
        name: block.querySelector('.cc-name').value, color: block.querySelector('.cc-color').value,
        points: Array.from(block.querySelectorAll('.pt-row')).map((row) => [row.querySelector('.pt-i').value, row.querySelector('.pt-t').value]),
        pasteOpen: block.querySelector('.paste-box').style.display !== 'none',
      }));
      return data;
    },
    restoreDraft(data) {
      applyAll(data);
      hostRef.querySelectorAll('#cc-curves .curve-block').forEach((block, index) => {
        block.querySelector('.paste-box').style.display = data.curves[index]?.pasteOpen ? 'block' : 'none';
      });
    },
    refreshDraft: updateBattery,
  });
})();
