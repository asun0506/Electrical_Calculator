/**
 * IEC 60664-1 系统级三级绝缘距离校核与报告。
 * 复用 calc-iec60664.js 暴露的 IEC60664Core 标准查表结果。
 */
(function () {
  'use strict';

  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const Core = window.IEC60664Core;
  const STORAGE_KEY = 'electrical_toolkit_iec60664_verification_v1';
  const LEVELS = [
    { id: 'cell', name: '电芯级', code: 'CELL', voltage: 4.2 },
    { id: 'module', name: '模组级', code: 'MODULE', voltage: 60 },
    { id: 'pack', name: 'PACK级', code: 'PACK', voltage: 800 },
  ];
  const TOL_TYPES = {
    size: { label: '尺寸公差 ±t', factor: 1, note: '输入值按单侧 ±t 贡献' },
    profile: { label: '轮廓度 t', factor: 0.5, note: '总公差带宽 t，折算单侧 t/2' },
    position: { label: '位置度 ⌀t', factor: 0.5, note: '直径公差带 ⌀t，折算径向 t/2' },
    flatness: { label: '平面度 t', factor: 1, note: '按全值 t 贡献' },
    parallelism: { label: '平行度 t', factor: 1, note: '按全值 t 贡献' },
    perpendicularity: { label: '垂直度 t', factor: 1, note: '按全值 t 贡献' },
    custom: { label: '自定义', factor: 1, note: '按用户输入的折算系数' },
  };
  const VERIFY_METHODS = {
    rss3: { label: 'RSS 3σ（默认）', short: 'RSS 3σ', sigma: 3 },
    rss4: { label: 'RSS 4σ', short: 'RSS 4σ', sigma: 4 },
    rss6: { label: 'RSS 6σ', short: 'RSS 6σ', sigma: 6 },
    worst: { label: '极值法', short: '极值法', sigma: null },
  };

  let state;
  let currentHost;
  let saveTimer = null;

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function today() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function newContributor() {
    return { id: uid('tc'), name: '', size: '', tolerance: '', type: 'size', direction: '+', factor: 1 };
  }

  function newDimension() {
    return {
      id: uid('dim'), name: '', kind: 'clearance', image: '', nominal: '',
      toleranceMode: 'direct', lowerDeviation: '', upperDeviation: '',
      verificationMethod: 'rss3',
      contributors: [newContributor()], expanded: true,
    };
  }

  function defaultState() {
    return {
      schemaVersion: 1,
      project: { name: '绝缘距离系统设计校核', number: '', author: '', date: today(), standard: 'IEC 60664-1' },
      levels: LEVELS.map((item, index) => ({
        id: item.id, name: item.name, code: item.code,
        voltage: item.voltage, altitude: 2000, pollution: index === 0 ? '2' : '3', material: 'IIIa',
        dimensions: [],
      })),
    };
  }

  function normalize(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== 'object') return base;
    base.project = Object.assign(base.project, raw.project || {});
    base.levels = base.levels.map((level, index) => {
      const source = Array.isArray(raw.levels) ? (raw.levels.find((item) => item && item.id === level.id) || raw.levels[index]) : null;
      if (!source) return level;
      const normalized = Object.assign(level, source);
      normalized.dimensions = Array.isArray(source.dimensions) ? source.dimensions.map((dim) => {
        const result = Object.assign(newDimension(), dim || {});
        result.id = result.id || uid('dim');
        result.image = typeof result.image === 'string' && result.image.startsWith('data:image/') ? result.image : '';
        result.verificationMethod = VERIFY_METHODS[result.verificationMethod] ? result.verificationMethod : 'rss3';
        result.contributors = Array.isArray(result.contributors) && result.contributors.length
          ? result.contributors.map((part) => Object.assign(newContributor(), part || {}))
          : [newContributor()];
        return result;
      }) : [];
      return normalized;
    });
    return base;
  }

  function loadState() {
    try {
      return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
    } catch (error) {
      return defaultState();
    }
  }

  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        alert('保存失败：截图可能过大，已超出浏览器本地存储容量。请删除部分截图后重试。');
      }
    }, 120);
  }

  function persistNow() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      alert('保存失败：截图可能过大，已超出浏览器本地存储容量。请删除部分截图后重试。');
      return false;
    }
  }

  function n(value) {
    return E.parseNum(value);
  }

  function f(value) {
    return Number.isFinite(value) ? E.fmtExact(value) : '—';
  }

  function selected(value, expected) {
    return String(value) === String(expected) ? ' selected' : '';
  }

  function verificationMethod(dim) {
    return VERIFY_METHODS[dim.verificationMethod] ? dim.verificationMethod : 'rss3';
  }

  function verificationLabel(dim) {
    return VERIFY_METHODS[verificationMethod(dim)].short;
  }

  function toleranceReferences(result) {
    return `3σ ±${f(result.rss3)} · 4σ ±${f(result.rss4)} · 6σ ±${f(result.rss6)} · 极值 ±${f(result.wc)}`;
  }

  function calculateDimension(dim, standard) {
    const spec = standard && standard.valid
      ? (dim.kind === 'creepage' ? standard.creepage : standard.clearance)
      : null;
    let nominal = n(dim.nominal);
    let lower = null;
    let upper = null;
    let wc = null;
    let rss = null;
    let rss3 = null;
    let rss4 = null;
    let rss6 = null;
    let sigma = null;
    let selectedTolerance = null;
    let validParts = [];

    if (dim.toleranceMode === 'chain') {
      let nominalSum = 0;
      let wcSum = 0;
      let rssSq = 0;
      validParts = (dim.contributors || []).map((part) => {
        const size = n(part.size);
        const tolerance = n(part.tolerance);
        const typeInfo = TOL_TYPES[part.type] || TOL_TYPES.custom;
        const factor = part.type === 'custom' ? Math.abs(n(part.factor) == null ? 1 : n(part.factor)) : typeInfo.factor;
        if (size == null || tolerance == null || tolerance < 0) return null;
        const contribution = Math.abs(tolerance) * factor;
        const direction = part.direction === '-' ? -1 : 1;
        nominalSum += direction * size;
        wcSum += contribution;
        rssSq += contribution * contribution;
        return Object.assign({}, part, { size, tolerance, factor, contribution, direction });
      }).filter(Boolean);
      if (validParts.length) {
        nominal = nominalSum;
        wc = wcSum;
        rss = Math.sqrt(rssSq);
        sigma = rss / 3;
        rss3 = rss;
        rss4 = sigma * 4;
        rss6 = sigma * 6;
        const method = verificationMethod(dim);
        selectedTolerance = method === 'worst' ? wc : { rss3, rss4, rss6 }[method];
        lower = -selectedTolerance;
        upper = selectedTolerance;
      }
    } else if (nominal != null) {
      const lo = n(dim.lowerDeviation);
      const hi = n(dim.upperDeviation);
      lower = lo == null ? 0 : -Math.abs(lo);
      upper = hi == null ? 0 : Math.abs(hi);
      wc = Math.max(Math.abs(lower), Math.abs(upper));
      rss = wc;
      sigma = rss / 3;
      rss3 = rss;
      rss4 = sigma * 4;
      rss6 = sigma * 6;
      selectedTolerance = wc;
    }

    const inputComplete = dim.toleranceMode === 'chain'
      ? validParts.length > 0 && validParts.length === (dim.contributors || []).length
      : nominal != null;
    const minimum = nominal == null || lower == null ? null : nominal + lower;
    const maximum = nominal == null || upper == null ? null : nominal + upper;
    const complete = inputComplete && Number.isFinite(minimum) && Number.isFinite(spec);
    const pass = complete ? minimum >= spec : null;
    return { spec, nominal, lower, upper, minimum, maximum, wc, rss, rss3, rss4, rss6, sigma, selectedTolerance, verificationMethod: verificationMethod(dim), validParts, inputComplete, complete, pass };
  }

  function layerSummary(level) {
    const standard = Core.calculate(level);
    const results = level.dimensions.map((dim) => calculateDimension(dim, standard));
    const completed = results.filter((item) => item.complete);
    const failed = completed.filter((item) => item.pass === false);
    return {
      standard, results, completed: completed.length, failed: failed.length,
      status: !standard.valid ? 'invalid'
        : failed.length ? 'fail'
        : !level.dimensions.length || completed.length !== level.dimensions.length ? 'pending'
        : 'pass',
    };
  }

  function statusLabel(status) {
    return { pass: '通过', fail: '不通过', pending: '待校核', invalid: '参数无效' }[status] || '待校核';
  }

  function statusClass(status) {
    return { pass: 'ok', fail: 'err', pending: 'warn', invalid: 'err' }[status] || 'warn';
  }

  function projectPanel() {
    const p = state.project;
    return `
      <div class="panel iec-project-panel">
        <div class="iec-head-row">
          <h3 class="panel-title"><span class="dot"></span>报告与项目参数</h3>
          <div class="btn-row iec-report-actions">
            <button class="btn btn-ghost" data-action="import-json">导入 JSON</button>
            <button class="btn btn-ghost" data-action="export-json">导出 JSON</button>
            <button class="btn btn-ghost" data-action="export-word">导出 Word (.doc)</button>
            <button class="btn btn-primary" data-action="export-pdf">导出 PDF（打印）</button>
            <button class="btn btn-del" data-action="clear-project">清空当前校核</button>
            <input class="iec-json-file" type="file" accept="application/json,.json">
          </div>
        </div>
        <div class="grid cols-4">
          <div class="field"><label>项目名称</label><input class="iec-plain-input" data-project="name" value="${E.escapeHtml(p.name)}"></div>
          <div class="field"><label>项目编号</label><input class="iec-plain-input" data-project="number" value="${E.escapeHtml(p.number)}" placeholder="可选"></div>
          <div class="field"><label>编制人</label><input class="iec-plain-input" data-project="author" value="${E.escapeHtml(p.author)}" placeholder="可选"></div>
          <div class="field"><label>日期</label><input class="iec-plain-input" type="date" data-project="date" value="${E.escapeHtml(p.date)}"></div>
        </div>
        <div class="note" style="margin-top:14px">
          项目自动保存在当前浏览器。尺寸链默认采用 <b>RSS 3σ</b> 判定，也可逐条切换为 RSS 4σ、RSS 6σ 或极值法；所有方法的参考值会同时显示。标准数据沿用本工具 IEC 60664-1 表 F.2（Case A）/F.5 与海拔修正逻辑，最终设计仍需结合绝缘类型及适用产品标准复核。
        </div>
      </div>`;
  }

  function standardCards(standard) {
    if (!standard.valid) return `<div class="status-banner err">${E.escapeHtml(standard.error)}</div>`;
    return `
      <div class="result-grid iec-standard-grid">
        <div class="result-card"><div class="k">额定冲击耐受电压 Uimp</div><div class="v">${f(standard.impulseKV)}<small> kV</small></div></div>
        <div class="result-card"><div class="k">最小电气间隙</div><div class="v">${f(standard.clearance)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">最小爬电距离</div><div class="v">${f(standard.creepage)}<small> mm</small></div></div>
        <div class="result-card"><div class="k">海拔修正系数</div><div class="v">${f(standard.altitudeFactor)}<small> ×</small></div></div>
      </div>`;
  }

  function dimensionRow(levelIndex, dimIndex, dim, result) {
    const image = dim.image
      ? `<button class="iec-image-button" data-action="pick-image" data-level="${levelIndex}" data-dim="${dimIndex}" title="更换截图"><img src="${dim.image}" alt="尺寸截图"></button>`
      : `<button class="iec-image-empty" data-action="pick-image" data-level="${levelIndex}" data-dim="${dimIndex}">添加截图</button>`;
    const toleranceText = dim.toleranceMode === 'chain'
      ? `±${f(result.selectedTolerance)} (${verificationLabel(dim)})<small>${toleranceReferences(result)}</small>`
      : `${f(result.lower)} / +${f(result.upper)}`;
    const status = result.complete ? (result.pass ? 'pass' : 'fail') : 'pending';
    return `
      <tr class="iec-check-row ${status}">
        <td class="iec-row-index">${dimIndex + 1}</td>
        <td><input class="iec-table-input" data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="name" value="${E.escapeHtml(dim.name)}" placeholder="关键尺寸名称"></td>
        <td class="iec-image-cell">${image}<input class="iec-image-file" type="file" accept="image/*" data-level="${levelIndex}" data-dim="${dimIndex}"></td>
        <td><select class="iec-table-select" data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="kind">
          <option value="clearance"${selected(dim.kind, 'clearance')}>电气间隙</option>
          <option value="creepage"${selected(dim.kind, 'creepage')}>爬电距离</option>
        </select></td>
        <td class="iec-number">${f(result.nominal)}</td>
        <td class="iec-tolerance-value">${toleranceText}</td>
        <td class="iec-number"><strong>${f(result.minimum)}</strong></td>
        <td class="iec-number">${f(result.spec)}</td>
        <td><span class="iec-status ${status}">${status === 'pass' ? '通过' : status === 'fail' ? '不通过' : '待输入'}</span></td>
        <td class="iec-actions">
          <button class="btn btn-ghost btn-sm" data-action="toggle-dim" data-level="${levelIndex}" data-dim="${dimIndex}">${dim.expanded ? '收起' : '编辑'}</button>
          <button class="btn btn-del btn-sm" data-action="remove-dim" data-level="${levelIndex}" data-dim="${dimIndex}">删除</button>
        </td>
      </tr>
      ${dim.expanded ? `<tr class="iec-detail-row"><td colspan="10">${dimensionEditor(levelIndex, dimIndex, dim, result)}</td></tr>` : ''}`;
  }

  function dimensionEditor(levelIndex, dimIndex, dim, result) {
    const direct = dim.toleranceMode !== 'chain';
    return `
      <div class="iec-dim-editor">
        <div class="iec-editor-top">
          <div class="field"><label>公差计算方式</label><select data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="toleranceMode">
            <option value="direct"${selected(dim.toleranceMode, 'direct')}>直接输入上下偏差</option>
            <option value="chain"${selected(dim.toleranceMode, 'chain')}>尺寸链 RSS（默认判定）</option>
          </select></div>
          ${direct ? `
            <div class="field"><label>名义尺寸 (mm)</label><input class="iec-plain-input" type="number" step="any" data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="nominal" value="${E.escapeHtml(dim.nominal)}"></div>
            <div class="field"><label>下偏差 (mm)</label><input class="iec-plain-input" type="number" step="any" data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="lowerDeviation" value="${E.escapeHtml(dim.lowerDeviation)}" placeholder="例：-0.20"></div>
            <div class="field"><label>上偏差 (mm)</label><input class="iec-plain-input" type="number" step="any" data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="upperDeviation" value="${E.escapeHtml(dim.upperDeviation)}" placeholder="例：+0.20"></div>` : `
            <div class="field"><label>判定方式</label><select data-level="${levelIndex}" data-dim="${dimIndex}" data-dim-field="verificationMethod">
              ${Object.keys(VERIFY_METHODS).map((key) => `<option value="${key}"${selected(verificationMethod(dim), key)}>${VERIFY_METHODS[key].label}</option>`).join('')}
            </select></div>
            <div class="iec-rss-result"><span>闭环名义</span><b>${f(result.nominal)} mm</b></div>
            <div class="iec-rss-result"><span>RSS 3σ（默认）</span><b>±${f(result.rss3)} mm</b></div>
            <div class="iec-rss-result"><span>RSS 4σ 参考</span><b>±${f(result.rss4)} mm</b></div>
            <div class="iec-rss-result"><span>RSS 6σ 参考</span><b>±${f(result.rss6)} mm</b></div>
            <div class="iec-rss-result"><span>σ</span><b>${f(result.sigma)} mm</b></div>
            <div class="iec-rss-result secondary"><span>极值参考</span><b>±${f(result.wc)} mm</b></div>`}
        </div>
        ${direct ? '' : chainEditor(levelIndex, dimIndex, dim, result)}
        ${dim.image ? `<div class="btn-row"><button class="btn btn-del btn-sm" data-action="remove-image" data-level="${levelIndex}" data-dim="${dimIndex}">移除截图</button></div>` : ''}
      </div>`;
  }

  function chainEditor(levelIndex, dimIndex, dim, result) {
    const rows = dim.contributors.map((part, chainIndex) => {
      const info = TOL_TYPES[part.type] || TOL_TYPES.custom;
      const effectiveFactor = part.type === 'custom' ? part.factor : info.factor;
      return `
        <div class="iec-chain-row">
          <input data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="name" value="${E.escapeHtml(part.name)}" placeholder="尺寸名">
          <input type="number" step="any" data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="size" value="${E.escapeHtml(part.size)}" placeholder="尺寸 mm">
          <input type="number" min="0" step="any" data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="tolerance" value="${E.escapeHtml(part.tolerance)}" placeholder="公差 t">
          <select data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="type">
            ${Object.keys(TOL_TYPES).map((key) => `<option value="${key}"${selected(part.type, key)}>${TOL_TYPES[key].label}</option>`).join('')}
          </select>
          <select data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="direction">
            <option value="+"${selected(part.direction, '+')}>增环 +</option><option value="-"${selected(part.direction, '-')}>减环 −</option>
          </select>
          <input type="number" min="0" step="any" ${part.type === 'custom' ? '' : 'disabled'} data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" data-chain-field="factor" value="${E.escapeHtml(effectiveFactor)}" title="公差折算系数">
          <button class="row-del" data-action="remove-chain" data-level="${levelIndex}" data-dim="${dimIndex}" data-chain="${chainIndex}" title="删除环节">✕</button>
        </div>`;
    }).join('');
    const chart = result.validParts.length && result.sigma > 0
      ? `<div class="iec-chain-chart">${T.normalChart({
          title: `尺寸链公差带分布（${verificationLabel(dim)} = ±${f(result.selectedTolerance)} mm）`,
          mean: result.nominal, sigma: result.sigma, tol: result.selectedTolerance, width: 520, height: 300,
          note: `当前判定：${verificationLabel(dim)} ±${f(result.selectedTolerance)} mm；σ = ${f(result.sigma)} mm；${toleranceReferences(result)} mm。`,
        })}</div>`
      : `<div class="iec-chain-chart iec-chain-chart-empty">填写完整尺寸链后显示所选判定方式的公差带分布图</div>`;
    return `
      <div class="iec-chain-box">
        <div class="iec-chain-layout">
          <div class="iec-chain-inputs">
            <div class="iec-chain-head">
              <div><strong>尺寸链环节</strong><small>尺寸方向决定闭环名义值；公差贡献按类型折算后进行 RSS 合成。</small></div>
              <button class="btn btn-ghost btn-sm" data-action="add-chain" data-level="${levelIndex}" data-dim="${dimIndex}">添加尺寸</button>
            </div>
            <div class="iec-chain-labels"><span>尺寸名</span><span>尺寸/mm</span><span>公差 t/mm</span><span>公差类型</span><span>方向</span><span>折算系数</span><span></span></div>
            ${rows}
            <div class="iec-tol-assumption">轮廓度与位置度默认按总公差带折算为单侧 t/2；普通尺寸公差按 ±t；平面度、平行度、垂直度按全值 t。尺寸链合成值默认视为 3σ，由此反算σ并给出 4σ、6σ参考；极值法按各公差贡献绝对值直接累加。</div>
          </div>
          ${chart}
        </div>
      </div>`;
  }

  function levelPanel(level, levelIndex) {
    const summary = layerSummary(level);
    const s = summary.standard;
    const dimensionRows = level.dimensions.length
      ? level.dimensions.map((dim, dimIndex) => dimensionRow(levelIndex, dimIndex, dim, summary.results[dimIndex])).join('')
      : `<tr><td colspan="10"><div class="pe-empty">尚未添加关键尺寸<small>点击下方按钮建立第一条电气间隙或爬电距离校核。</small></div></td></tr>`;
    return `
      <section class="panel iec-level-panel" data-level-panel="${levelIndex}">
        <div class="iec-level-title">
          <div><span class="iec-level-code">${level.code}</span><h3>${level.name}系统边界</h3></div>
          <span class="iec-level-status ${summary.status}">${statusLabel(summary.status)}</span>
        </div>
        <div class="grid cols-4 iec-level-inputs">
          <div class="field"><label>对地工作电压 U (RMS)</label><div class="input-row"><input type="number" min="0" step="any" data-level="${levelIndex}" data-level-field="voltage" value="${E.escapeHtml(level.voltage)}"><span class="unit">V</span></div></div>
          <div class="field"><label>海拔</label><div class="input-row"><input type="number" min="0" step="any" data-level="${levelIndex}" data-level-field="altitude" value="${E.escapeHtml(level.altitude)}"><span class="unit">m</span></div></div>
          <div class="field"><label>污染等级</label><select data-level="${levelIndex}" data-level-field="pollution"><option value="1"${selected(level.pollution, '1')}>等级 1</option><option value="2"${selected(level.pollution, '2')}>等级 2</option><option value="3"${selected(level.pollution, '3')}>等级 3</option></select></div>
          <div class="field"><label>材料组别</label><select data-level="${levelIndex}" data-level-field="material"><option value="I"${selected(level.material, 'I')}>I（CTI ≥ 600）</option><option value="II"${selected(level.material, 'II')}>II（400–600）</option><option value="IIIa"${selected(level.material, 'IIIa')}>IIIa（175–400）</option><option value="IIIb"${selected(level.material, 'IIIb')}>IIIb（100–175）</option></select></div>
        </div>
        ${standardCards(s)}
        <div class="iec-table-wrap">
          <table class="iec-check-table">
            <thead><tr><th>#</th><th>关键尺寸名称</th><th>截图</th><th>类别</th><th>名义/mm</th><th>公差/mm</th><th>最小/mm</th><th>标准/mm</th><th>结论</th><th>操作</th></tr></thead>
            <tbody>${dimensionRows}</tbody>
          </table>
        </div>
        <div class="iec-level-footer">
          <button class="btn btn-ghost" data-action="add-dim" data-level="${levelIndex}">添加关键尺寸</button>
          <span>已完成 ${summary.completed}/${level.dimensions.length} 条；不通过 ${summary.failed} 条</span>
        </div>
      </section>`;
  }

  function overallPanel() {
    const summaries = state.levels.map(layerSummary);
    const anyFail = summaries.some((item) => item.status === 'fail' || item.status === 'invalid');
    const allPass = summaries.every((item) => item.status === 'pass');
    const overall = anyFail ? 'fail' : allPass ? 'pass' : 'pending';
    return `
      <div class="panel iec-overall">
        <div class="iec-level-title"><div><span class="iec-level-code">SUMMARY</span><h3>系统绝缘距离校核汇总结论</h3></div><span class="iec-level-status ${overall}">${statusLabel(overall)}</span></div>
        <div class="iec-summary-grid">
          ${state.levels.map((level, index) => {
            const item = summaries[index];
            const s = item.standard;
            return `<div class="iec-summary-card ${item.status}"><span>${level.name}</span><strong>${statusLabel(item.status)}</strong><small>${s.valid ? `电气间隙 ≥ ${f(s.clearance)} mm · 爬电距离 ≥ ${f(s.creepage)} mm` : E.escapeHtml(s.error)}</small><em>${item.completed}/${level.dimensions.length} 条完成，${item.failed} 条不通过</em></div>`;
          }).join('')}
        </div>
        <div class="status-banner ${statusClass(overall)}">${overall === 'pass' ? '三层边界下所有已建立的关键尺寸均按各自选定的公差判定方式通过。' : overall === 'fail' ? '至少一个层级存在参数错误或关键尺寸不满足要求，请查看红色条目。' : '请补充三个层级的关键尺寸并完成校核；未完成条目不计为通过。'}</div>
      </div>`;
  }

  function referencePanel() {
    return `
      <div class="panel iec-reference-panel">
        <details><summary>标准参考图表与计算假设</summary>
          <div class="note" style="margin-top:14px">额定冲击耐受电压沿用 Uimp = ceil((2U + 1000) × 1.414)；电气间隙采用表 F.2 Case A 并乘海拔系数，爬电距离采用表 F.5。绝缘类型、均匀场、涂覆、微环境及具体产品标准要求未自动叠加。</div>
          <div class="ref-block"><div class="ref-title">表 F.2 — 电气间隙</div><div class="ref-scroll"><img class="ref-img" src="img/iec60664-f2.png" alt="表 F.2 电气间隙"></div></div>
          <div class="ref-block"><div class="ref-title">表 F.5 — 爬电距离</div><div class="ref-scroll"><img class="ref-img" src="img/iec60664-f5.png" alt="表 F.5 爬电距离"></div></div>
          <div class="ref-block"><div class="ref-title">海拔修正系数</div><div class="ref-scroll"><img class="ref-img" src="img/iec60664-alt.png" alt="海拔修正系数"></div></div>
        </details>
      </div>`;
  }

  function renderAll() {
    if (!currentHost) return;
    currentHost.innerHTML = projectPanel() + state.levels.map(levelPanel).join('') + overallPanel() + referencePanel();
  }

  function updateFromControl(target) {
    const projectField = target.dataset.project;
    if (projectField) state.project[projectField] = target.value;
    const levelIndex = Number(target.dataset.level);
    if (!Number.isInteger(levelIndex) || !state.levels[levelIndex]) return saveState();
    const level = state.levels[levelIndex];
    if (target.dataset.levelField) level[target.dataset.levelField] = target.value;
    const dimIndex = Number(target.dataset.dim);
    if (!Number.isInteger(dimIndex) || !level.dimensions[dimIndex]) return saveState();
    const dim = level.dimensions[dimIndex];
    if (target.dataset.dimField) dim[target.dataset.dimField] = target.value;
    const chainIndex = Number(target.dataset.chain);
    if (Number.isInteger(chainIndex) && dim.contributors[chainIndex] && target.dataset.chainField) {
      dim.contributors[chainIndex][target.dataset.chainField] = target.value;
    }
    saveState();
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const levelIndex = Number(button.dataset.level);
    const dimIndex = Number(button.dataset.dim);
    const level = state.levels[levelIndex];
    const dim = level && level.dimensions[dimIndex];
    if (action === 'add-dim' && level) level.dimensions.push(newDimension());
    else if (action === 'remove-dim' && dim && confirm(`确定删除关键尺寸“${dim.name || dimIndex + 1}”吗？`)) level.dimensions.splice(dimIndex, 1);
    else if (action === 'toggle-dim' && dim) dim.expanded = !dim.expanded;
    else if (action === 'add-chain' && dim) dim.contributors.push(newContributor());
    else if (action === 'remove-chain' && dim) {
      const chainIndex = Number(button.dataset.chain);
      if (dim.contributors.length > 1) dim.contributors.splice(chainIndex, 1);
      else dim.contributors[0] = newContributor();
    } else if (action === 'pick-image' && dim) {
      const input = currentHost.querySelector(`.iec-image-file[data-level="${levelIndex}"][data-dim="${dimIndex}"]`);
      if (input) input.click();
      return;
    } else if (action === 'remove-image' && dim) dim.image = '';
    else if (action === 'import-json') {
      const input = currentHost.querySelector('.iec-json-file');
      if (input) input.click();
      return;
    } else if (action === 'export-json') return exportJson();
    else if (action === 'clear-project') {
      if (!confirm('确定清空当前校核吗？三级系统参数、所有关键尺寸、尺寸链和已上传图片都将被删除，此操作无法撤销。建议先导出 JSON 备份。')) return;
      clearTimeout(saveTimer);
      state = defaultState();
      try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
      persistNow();
    }
    else if (action === 'export-pdf') return exportPdf();
    else if (action === 'export-word') return exportWord();
    else return;
    saveState();
    renderAll();
  }

  function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function reportDimensionRows(level, summary) {
    if (!level.dimensions.length) return '<tr><td colspan="9">未建立关键尺寸</td></tr>';
    return level.dimensions.map((dim, index) => {
      const r = summary.results[index];
      const status = r.complete ? (r.pass ? '通过' : '不通过') : '待输入';
      const tol = dim.toleranceMode === 'chain'
        ? `±${f(r.selectedTolerance)} (${verificationLabel(dim)})<small>${toleranceReferences(r)}</small>`
        : `${f(r.lower)} / +${f(r.upper)}`;
      const image = dim.image ? `<img class="report-image" src="${dim.image}" alt="尺寸截图">` : '—';
      return `<tr><td>${index + 1}</td><td>${E.escapeHtml(dim.name || '未命名')}</td><td>${image}</td><td>${dim.kind === 'creepage' ? '爬电距离' : '电气间隙'}</td><td>${f(r.nominal)}</td><td>${tol}</td><td>${f(r.minimum)}</td><td>${f(r.spec)}</td><td class="report-${status === '通过' ? 'pass' : status === '不通过' ? 'fail' : 'pending'}">${status}</td></tr>`;
    }).join('');
  }

  function reportChainDetails(level, summary) {
    return level.dimensions.map((dim, dimIndex) => {
      if (dim.toleranceMode !== 'chain') return '';
      const r = summary.results[dimIndex];
      const rows = r.validParts.map((part) => `<tr><td>${E.escapeHtml(part.name || '尺寸')}</td><td>${f(part.size)}</td><td>${f(part.tolerance)}</td><td>${E.escapeHtml((TOL_TYPES[part.type] || TOL_TYPES.custom).label)}</td><td>${part.direction > 0 ? '增环' : '减环'}</td><td>${f(part.factor)}</td><td>${f(part.contribution)}</td></tr>`).join('');
      const chart = r.validParts.length && r.sigma > 0 ? T.normalChart({ title: `${E.escapeHtml(dim.name || '关键尺寸')} — ${verificationLabel(dim)} 公差带`, mean: r.nominal, sigma: r.sigma, tol: r.selectedTolerance, width: 480, height: 250, note: `当前判定：${verificationLabel(dim)} ±${f(r.selectedTolerance)} mm；σ = ${f(r.sigma)} mm；${toleranceReferences(r)} mm。` }) : '<div class="report-chart-empty">尺寸链不完整，暂无分布图</div>';
      return `<div class="report-chain"><h4>${E.escapeHtml(dim.name || '关键尺寸')} — 尺寸链明细与公差分布</h4>
        <table class="report-chain-layout"><colgroup><col style="width:57%"><col style="width:43%"></colgroup><tr>
          <td class="report-chain-table-cell"><table class="report-chain-table"><thead><tr><th>尺寸名</th><th>尺寸/mm</th><th>公差/mm</th><th>类型</th><th>方向</th><th>系数</th><th>贡献/mm</th></tr></thead><tbody>${rows || '<tr><td colspan="7">尚未填写完整尺寸链</td></tr>'}</tbody></table></td>
          <td class="report-chain-chart-cell">${chart}</td>
        </tr></table></div>`;
    }).join('');
  }

  function buildReport() {
    const summaries = state.levels.map(layerSummary);
    const anyFail = summaries.some((item) => item.status === 'fail' || item.status === 'invalid');
    const allPass = summaries.every((item) => item.status === 'pass');
    const overall = anyFail ? '不通过' : allPass ? '通过' : '待完成';
    return `
      <article class="iec-report">
        <header><div><p>ENGINEERING VERIFICATION REPORT</p><h1>电气间隙 / 爬电距离系统设计校核报告</h1></div><strong class="report-overall ${overall === '通过' ? 'report-pass' : overall === '不通过' ? 'report-fail' : 'report-pending'}">${overall}</strong></header>
        <table class="report-meta"><tr><th>项目名称</th><td>${E.escapeHtml(state.project.name)}</td><th>项目编号</th><td>${E.escapeHtml(state.project.number || '—')}</td></tr><tr><th>编制人</th><td>${E.escapeHtml(state.project.author || '—')}</td><th>日期</th><td>${E.escapeHtml(state.project.date || today())}</td></tr><tr><th>参考标准</th><td>${E.escapeHtml(state.project.standard)}</td><th>判定方法</th><td>关键尺寸逐条选择（默认 RSS 3σ）</td></tr></table>
        ${state.levels.map((level, index) => {
          const item = summaries[index];
          const s = item.standard;
          return `<section class="report-level"><h2><span>${level.code}</span>${level.name}校核 — ${statusLabel(item.status)}</h2>
            <table class="report-boundary"><tr><th>工作电压</th><td>${E.escapeHtml(level.voltage)} V</td><th>海拔</th><td>${E.escapeHtml(level.altitude)} m</td><th>污染等级</th><td>${E.escapeHtml(level.pollution)}</td><th>材料组别</th><td>${E.escapeHtml(level.material)}</td></tr>${s.valid ? `<tr><th>Uimp</th><td>${f(s.impulseKV)} kV</td><th>电气间隙标准</th><td>${f(s.clearance)} mm</td><th>爬电距离标准</th><td>${f(s.creepage)} mm</td><th>海拔系数</th><td>${f(s.altitudeFactor)}</td></tr>` : `<tr><td colspan="8" class="report-fail">${E.escapeHtml(s.error)}</td></tr>`}</table>
            <table class="report-checks"><thead><tr><th>#</th><th>关键尺寸</th><th>截图</th><th>类别</th><th>名义/mm</th><th>公差/mm</th><th>最小/mm</th><th>标准/mm</th><th>结论</th></tr></thead><tbody>${reportDimensionRows(level, item)}</tbody></table>
            ${reportChainDetails(level, item)}
          </section>`;
        }).join('')}
        <section class="report-conclusion"><h2>汇总结论</h2><p>系统总体结论：<strong>${overall}</strong>。尺寸链默认按 RSS 3σ 判定，并允许每条关键尺寸独立选择 RSS 4σ、RSS 6σ 或极值法。RSS 法假设各尺寸环节独立且近似正态分布；极值法按公差贡献绝对值累加。具体判定方法与 3σ/4σ/6σ/极值参考值见各条记录。</p><ul>${state.levels.map((level, index) => `<li>${level.name}：${statusLabel(summaries[index].status)}，完成 ${summaries[index].completed}/${level.dimensions.length} 条，不通过 ${summaries[index].failed} 条。</li>`).join('')}</ul></section>
        <footer>本报告由电气工程师综合计算器生成。标准表格、绝缘类型及具体产品要求应由工程师在设计冻结前复核。</footer>
      </article>`;
  }

  function reportStyle() {
    return `
      body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#172230;background:#fff;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact} .iec-report{width:281mm;max-width:281mm;min-height:194mm;box-sizing:border-box;margin:0 auto;padding:8mm;font-size:10.5pt;line-height:1.4}
      .iec-report header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #173b5e;padding-bottom:14px;margin-bottom:16px}.iec-report header p{margin:0;color:#9b6500;font-size:10px;letter-spacing:.14em}.iec-report h1{font-size:23px;margin:3px 0}.iec-report h2{font-size:16px;color:#173b5e;border-bottom:1px solid #aebac6;padding-bottom:6px}.iec-report h2 span{font-size:9px;border:1px solid #71879a;padding:2px 5px;margin-right:8px}.iec-report h4{margin:14px 0 6px}
      .report-overall{padding:8px 14px;border:2px solid;font-size:16px}.report-pass{color:#08775a}.report-fail{color:#b42318}.report-pending{color:#9a6400}
      .iec-report table{width:100%;border-collapse:collapse;margin:8px 0 14px;table-layout:fixed}.iec-report th,.iec-report td{border:1px solid #bfc9d3;padding:6px 7px;vertical-align:middle;word-break:break-word}.iec-report th{background:#edf2f6;color:#274159}.report-meta th{width:12%}.report-meta td{width:38%}.report-boundary th{width:10%}.report-checks th:nth-child(1){width:3%}.report-checks th:nth-child(2){width:16%}.report-checks th:nth-child(3){width:20%}.report-checks th:nth-child(4){width:9%}.report-checks th:nth-child(5),.report-checks th:nth-child(6),.report-checks th:nth-child(7),.report-checks th:nth-child(8){width:9%}.report-checks th:nth-child(9){width:8%}
      .report-image{display:block;max-width:100%;max-height:150px;margin:auto}.report-checks td small{display:block;margin-top:3px;color:#596b7a;font-size:7.5px;line-height:1.25}.report-level{break-before:page;page-break-before:always}.report-chain{break-inside:avoid;page-break-inside:avoid;margin-top:10px}.iec-report table.report-chain-layout{margin:5px 0 10px;table-layout:fixed;border-collapse:collapse}.report-chain-layout>tbody>tr>td{border:0;padding:0 6px;vertical-align:top}.report-chain-layout>tbody>tr>td:first-child{padding-left:0}.report-chain-layout>tbody>tr>td:last-child{padding-right:0}.iec-report table.report-chain-table{margin:0;font-size:9px;table-layout:fixed}.report-chain-table th,.report-chain-table td{padding:4px 3px}.report-chain-table th:nth-child(1){width:22%}.report-chain-table th:nth-child(2),.report-chain-table th:nth-child(3),.report-chain-table th:nth-child(5),.report-chain-table th:nth-child(6),.report-chain-table th:nth-child(7){width:11%}.report-chain-table th:nth-child(4){width:23%}.report-chain-chart-cell{border:1px solid #cbd5df!important;background:#fbfcfd}.report-chain-chart-cell .chart-title{text-align:center;font-size:11px;font-weight:700;margin:2px 0}.report-chain-chart-cell svg{display:block;max-height:205px}.report-chain-chart-cell .note{margin-top:2px;padding:4px 6px;font-size:8px;color:#43596c}.report-chart-empty{display:flex;align-items:center;justify-content:center;min-height:190px;color:#687887;font-size:10px}.chart-title{text-align:center;font-weight:700;margin-top:8px}.note{padding:6px;color:#43596c}.report-conclusion{border:2px solid #173b5e;padding:10px 14px;break-inside:avoid}.iec-report footer{margin-top:16px;border-top:1px solid #cfd7e1;padding-top:8px;color:#5e6b78;font-size:10px}
      @page{size:297mm 210mm;margin:8mm}`;
  }

  function reportFilename(ext) {
    const base = (state.project.name || '绝缘距离系统校核报告').replace(/[\\/:*?"<>|]/g, '_');
    return `${base}_${state.project.date || today()}.${ext}`;
  }

  function exportPdf() {
    const root = document.createElement('div');
    root.className = 'iec-print-root';
    root.innerHTML = `<style>${reportStyle()}</style>${buildReport()}`;
    document.body.appendChild(root);
    document.body.classList.add('iec-printing');
    const cleanup = () => {
      document.body.classList.remove('iec-printing');
      root.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 2000);
  }

  function exportWord() {
    const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${E.escapeHtml(state.project.name)}</title><style>${reportStyle()} @page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:28.35pt}.Section1{page:Section1}</style></head><body><div class="Section1">${buildReport()}</div></body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = reportFilename('doc');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    persistNow();
    const payload = Object.assign({}, state, { exportedAt: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = reportFilename('json');
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importJson(file, input) {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      alert('JSON 文件超过 30 MB，请减少或压缩截图后再导入。');
      input.value = '';
      return;
    }
    file.text().then((text) => {
      const raw = JSON.parse(text);
      if (!raw || raw.schemaVersion !== 1 || !raw.project || !Array.isArray(raw.levels)) {
        throw new Error('文件不是有效的绝缘距离系统校核 JSON（schemaVersion 1）。');
      }
      if (!confirm('导入将替换当前校核的全部参数、关键尺寸和图片，是否继续？')) return;
      state = normalize(raw);
      if (persistNow()) {
        renderAll();
        alert('校核项目导入成功，JSON 中的图片已一并恢复。');
      }
    }).catch((error) => {
      alert(`导入失败：${error.message || 'JSON 文件格式错误'}`);
    }).finally(() => { input.value = ''; });
  }

  T.register({
    id: 'iec60664',
    replace: true,
    title: '电气间隙/爬电距离',
    icon: '⚡',
    group: '电气计算',
    desc: '按电芯级、模组级和 PACK 级分层计算绝缘距离标准，支持 RSS 3σ/4σ/6σ 与极值法校核并导出工程报告。',
    render(host) {
      if (!Core) throw new Error('IEC 60664 标准数据未加载');
      state = loadState();
      currentHost = host;
      renderAll();

      host.addEventListener('input', (event) => {
        if (event.target.matches('[data-project],[data-level-field],[data-dim-field],[data-chain-field]')) updateFromControl(event.target);
      });
      host.addEventListener('change', (event) => {
        const target = event.target;
        if (target.classList.contains('iec-json-file')) {
          importJson(target.files && target.files[0], target);
          return;
        }
        if (target.classList.contains('iec-image-file') && target.files && target.files[0]) {
          const levelIndex = Number(target.dataset.level);
          const dimIndex = Number(target.dataset.dim);
          compressImage(target.files[0], (dataUrl) => {
            state.levels[levelIndex].dimensions[dimIndex].image = dataUrl;
            saveState();
            renderAll();
          });
          return;
        }
        if (target.matches('[data-level-field],[data-dim-field],[data-chain-field]')) {
          updateFromControl(target);
          renderAll();
        }
      });
      host.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (button) handleAction(button);
      });
    },
  });
})();
