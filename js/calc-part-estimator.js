/**
 * 子计算器：汽车零件模块化估价
 * 完全离线运行；底库只读，用户覆盖参数仅保存在当前项目与浏览器 localStorage。
 */
(function () {
  'use strict';

  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const DB = window.PART_ESTIMATOR_DATA;
  const STORAGE_KEY = 'electrical_toolkit_part_estimator_v1';
  let root = null;
  let project = loadProject();
  let activeId = project.parts[0].id;
  let notice = '估价项目已就绪';
  let dragRowId = null;

  T.register({
    id: 'part-estimator',
    captureDraft: () => ({ project: deepClone(project), activeId }),
    restoreDraft(saved) { project = normalizeProject(saved.project); activeId = saved.activeId || project.parts[0].id; renderAll(); },
    resetDraft() { project = newProject(); activeId = project.parts[0].id; saveProject(); renderAll(); },
    title: '汽车零件模块化估价',
    icon: '🧾',
    group: '成本估算',
    desc: '从原材料、生产工序、包装底库组合零件生产过程，支持标准工艺路线、参数覆盖、多零件项目及JSON/Excel导入导出。',
    render(host) {
      root = host;
      renderAll();
    },
  });

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function safe(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : (fallback || 0); }
  function positive(value, fallback) { const n = Number(value); return n > 0 ? n : (fallback || 1); }
  function nonNegative(value, fallback) { return Math.max(0, safe(value, fallback)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, safe(value))); }
  function money(value) { const n = safe(value); return `¥${n.toFixed(Math.abs(n) >= 100 ? 2 : 4)}`; }
  function unique(values) { return [...new Set(values)].filter(Boolean); }
  function esc(value) { return E.escapeHtml(value == null ? '' : String(value)); }
  function selectorValue(value) {
    const text = String(value == null ? '' : value);
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(text);
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function createPart(index) {
    const now = new Date().toISOString();
    return {
      id: uid(), createdAt: now, updatedAt: now,
      basics: {
        partNo: `PART-${String(index || 1).padStart(3, '0')}`,
        partName: '新零件', processDescription: '', dimensions: '', moldRequired: 'N',
        cavities: 1, surfaceArea: 0, marginRate: 15, transportFee: 300, transportQuantity: 5000,
      },
      materials: [], processes: [], packaging: [],
    };
  }

  function newProject() {
    return { schemaVersion: 1, projectName: '汽车零件估价项目', parts: [createPart(1)] };
  }

  function validProject(value) {
    return value && value.schemaVersion === 1 && Array.isArray(value.parts) && value.parts.length > 0
      && value.parts.every((part) => part && typeof part === 'object');
  }

  function normalizeProject(value) {
    if (!validProject(value)) return newProject();
    return {
      schemaVersion: 1,
      projectName: String(value.projectName || '汽车零件估价项目'),
      parts: value.parts.map((part, index) => {
        const base = createPart(index + 1);
        const basics = { ...base.basics, ...(part.basics && typeof part.basics === 'object' ? part.basics : {}) };
        const normalizeLines = (kind) => (Array.isArray(part[kind]) ? part[kind] : [])
          .filter((line) => line && typeof line === 'object')
          .map((line) => ({ ...line, rowId: line.rowId || uid() }));
        return {
          ...base,
          ...part,
          id: part.id || uid(),
          createdAt: part.createdAt || base.createdAt,
          updatedAt: part.updatedAt || base.updatedAt,
          basics,
          materials: normalizeLines('materials'),
          processes: normalizeLines('processes'),
          packaging: normalizeLines('packaging'),
        };
      }),
    };
  }

  function loadProject() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return validProject(value) ? normalizeProject(value) : newProject();
    } catch (error) { return newProject(); }
  }

  function saveProject() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
    catch (error) { notice = '本地保存失败，请导出JSON备份项目'; }
  }

  function activePart() {
    return project.parts.find((part) => part.id === activeId) || project.parts[0];
  }

  function materialCost(line) {
    const gross = nonNegative(line.unitPrice) * nonNegative(line.quantity);
    const scrap = 1 - clamp(line.utilization == null ? 100 : line.utilization, 0, 100) / 100;
    const credit = line.recyclable === 'Y' ? gross * scrap * clamp(line.recycleDiscount, 0, 100) / 100 : 0;
    return Math.max(0, gross - credit);
  }

  function processCost(line) {
    const capacity = 3600 / positive(line.cycleTime);
    const depreciation = nonNegative(line.equipmentPrice) / positive(line.equipmentYears) / positive(line.dailyHours) / positive(line.annualDays) / capacity;
    const electricity = nonNegative(line.electricityPrice) * nonNegative(line.power) / capacity;
    const gas = nonNegative(line.gasPrice) * nonNegative(line.gasUsage) / capacity;
    const consumables = ['lubricant', 'cuttingOil', 'water', 'tools', 'lowValue', 'otherLoss']
      .reduce((sum, key) => sum + nonNegative(line[key]), 0) / capacity;
    const labor = nonNegative(line.workers) * nonNegative(line.monthlySalary) / positive(line.workHours) / positive(line.monthlyDays) / capacity;
    const yieldRate = clamp(line.yieldRate == null ? 1 : line.yieldRate, 0.000001, 1);
    const unitCost = (depreciation + electricity + gas + consumables + labor) / yieldRate;
    return { capacity, depreciation, electricity, gas, consumables, labor, unitCost, total: unitCost * positive(line.count) };
  }

  function packagingCost(line) {
    const reuse = line.reusable === 'Y' ? positive(line.reuseCount) : 1;
    return nonNegative(line.price) * positive(line.packageQuantity) / positive(line.partsPerContainer) / reuse;
  }

  function totals(part) {
    const material = part.materials.reduce((sum, line) => sum + materialCost(line), 0);
    const process = part.processes.reduce((sum, line) => sum + processCost(line).total, 0);
    const packaging = part.packaging.reduce((sum, line) => sum + packagingCost(line), 0);
    const transport = nonNegative(part.basics.transportFee) / positive(part.basics.transportQuantity);
    const subtotal = material + process + packaging + transport;
    return { material, process, packaging, transport, subtotal, price: subtotal * (1 + nonNegative(part.basics.marginRate) / 100) };
  }

  function touchPart(part) { part.updatedAt = new Date().toISOString(); saveProject(); }

  function renderAll() {
    if (!DB) {
      root.innerHTML = '<div class="status-banner err">估价底库未加载，请确认 estimator-data.js 与HTML位于同一工具目录。</div>';
      return;
    }
    const part = activePart();
    const total = totals(part);
    root.innerHTML = `
      <div class="pe-toolbar panel">
        <div class="pe-project-name field"><label>估价项目名称</label><div class="input-row"><input id="pe-project-name" value="${esc(project.projectName)}"></div></div>
        <div class="pe-toolbar-actions">
          <input id="pe-project-file" type="file" accept=".json,application/json" hidden>
          <input id="pe-part-file" type="file" accept=".json,application/json" hidden>
          <button class="btn btn-ghost btn-sm" data-action="import-project">↓ 导入项目JSON</button>
          <button class="btn btn-ghost btn-sm" data-action="export-project-json">↑ 导出项目JSON</button>
          <button class="btn btn-primary btn-sm" data-action="export-project-excel">↑ 导出项目Excel</button>
          <button class="btn btn-ghost btn-sm" data-action="export-project-excel-en">↑ 导出项目英文Excel</button>
        </div>
      </div>

      <div class="pe-part-strip panel">
        <div class="pe-part-strip-head"><strong>零件清单 · ${project.parts.length}个</strong><button class="btn btn-primary btn-sm" data-action="add-part">＋ 新增零件</button></div>
        <div class="pe-part-tabs">${project.parts.map((item, index) => {
          const itemTotal = totals(item);
          return `<button class="pe-part-tab${item.id === part.id ? ' active' : ''}" data-open-part="${esc(item.id)}"><span>${String(index + 1).padStart(2, '0')}</span><b>${esc(item.basics.partName || '未命名零件')}</b><em>${esc(item.basics.partNo || '未填写零件号')}</em><strong>${money(itemTotal.price)}</strong></button>`;
        }).join('')}</div>
        <div class="pe-notice">${esc(notice)} · 数据自动保存在当前浏览器</div>
      </div>

      <div class="pe-layout">
        <div class="pe-main">
          ${renderPartHeader(part)}
          ${renderBasics(part)}
          ${renderMaterials(part, total)}
          ${renderProcesses(part, total)}
          ${renderPackaging(part, total)}
        </div>
        ${renderSummary(part, total)}
      </div>
    `;
    bindEvents();
    initAdders();
    initTemplatePicker();
  }

  function renderPartHeader(part) {
    return `<div class="pe-part-head panel">
      <div><div class="pe-eyebrow">ESTIMATE / ${esc(part.basics.partNo)}</div><h3>${esc(part.basics.partName || '未命名零件')}</h3><p>黄色字段为零件基础信息。原材料/工序支持一键添加，明细可自定义编辑。用户须对零件原材料及工艺有基础了解。</p></div>
      <div class="btn-row"><button class="btn btn-ghost btn-sm" data-action="duplicate-part">复制零件</button><button class="btn btn-del btn-sm" data-action="delete-part">删除</button></div>
    </div>`;
  }

  function basicField(label, key, value, unit, type) {
    const numericAttrs = type === 'number' ? ' step="any" min="0"' : '';
    return `<div class="field pe-yellow"><label>${label}</label><div class="input-row"><input data-basic="${key}" type="${type || 'text'}"${numericAttrs} value="${esc(value)}">${unit ? `<span class="unit">${unit}</span>` : ''}</div></div>`;
  }

  function renderBasics(part) {
    const b = part.basics;
    return `<section class="panel pe-panel"><div class="pe-section-head"><div><h3>▣ 零件基本信息 <span class="pe-count">8</span></h3><p>对应原工作表的标黄输入区域</p></div></div>
      <div class="grid cols-4">
        ${basicField('零件号', 'partNo', b.partNo)}${basicField('零件名称', 'partName', b.partName)}${basicField('加工工艺描述', 'processDescription', b.processDescription)}${basicField('外形尺寸', 'dimensions', b.dimensions, 'mm')}
        <div class="field pe-yellow"><label>是否开模</label><select data-basic="moldRequired"><option value="N"${b.moldRequired === 'N' ? ' selected' : ''}>否</option><option value="Y"${b.moldRequired === 'Y' ? ' selected' : ''}>是</option></select></div>
        ${basicField('模具腔数', 'cavities', b.cavities, '腔', 'number')}${basicField('零件表面积', 'surfaceArea', b.surfaceArea, 'mm²', 'number')}${basicField('毛利率 / 加价率', 'marginRate', b.marginRate, '%', 'number')}
      </div>
    </section>`;
  }

  function sectionHead(icon, title, count, total, label, kind) {
    return `<div class="pe-section-head"><div><h3><span class="pe-section-code">${icon}</span>${title} <span class="pe-count">${count}</span></h3><p>${kind === 'materials' ? '三级选择：原材类型 → 子类型 → 牌号/属性；m²材料按零件表面积自动带入' : kind === 'processes' ? '可载入标准路线，也可逐道添加；拖动工序卡片可调整顺序' : '包材按每箱/容器用量、装箱数量和循环次数摊销'}</p></div><div class="pe-section-total"><span>${label || '当前合计'}</span><strong data-module-total="${kind}">${money(total)}</strong></div><button class="btn btn-del btn-sm" data-clear="${kind}">一键清空</button></div>`;
  }

  function renderMaterials(part, total) {
    return `<section class="panel pe-panel">${sectionHead('MAT', '原材料', part.materials.length, total.material, '当前合计', 'materials')}
      <div class="pe-adder pe-material-adder"><div class="field"><label>原材类型</label><select id="pe-mat-cat"></select></div><div class="field"><label>原材子类型</label><select id="pe-mat-sub"></select></div><div class="field"><label>牌号 / 属性 / 厂商</label><select id="pe-mat-item"></select></div><button class="btn btn-primary" data-action="add-material">＋ 添加材料</button></div>
      <div id="pe-area-hint" class="pe-area-hint"></div>
      <div class="pe-line-list">${part.materials.length ? part.materials.map((line, index) => renderMaterialLine(line, index)).join('') : emptyLine('尚未添加材料')}</div>
    </section>`;
  }

  function textEdit(label, kind, rowId, key, value, unit, type) {
    const numericAttrs = type === 'number' ? ` step="any" min="0"${key === 'yieldRatePct' ? ' max="100"' : ''}` : '';
    return `<div class="field"><label>${label}</label><div class="input-row"><input data-line-kind="${kind}" data-row-id="${esc(rowId)}" data-line-key="${key}" type="${type || 'text'}"${numericAttrs} value="${esc(value)}">${unit ? `<span class="unit">${unit}</span>` : ''}</div></div>`;
  }

  function yesNoEdit(label, kind, rowId, key, value) {
    return `<div class="field"><label>${label}</label><select data-line-kind="${kind}" data-row-id="${esc(rowId)}" data-line-key="${key}"><option value="N"${value === 'N' ? ' selected' : ''}>否</option><option value="Y"${value === 'Y' ? ' selected' : ''}>是</option></select></div>`;
  }

  function renderMaterialLine(line, index) {
    return `<details class="pe-line-card"${index === 0 ? ' open' : ''} data-card-row="${esc(line.rowId)}"><summary><span class="pe-order">M${String(index + 1).padStart(2, '0')}</span><div><b>${esc(line.category)} · ${esc(line.subtype)}</b><em>${esc(line.spec || '/')} / ${esc(line.unit)}</em></div><strong data-line-cost="materials:${esc(line.rowId)}">${money(materialCost(line))}</strong><span>☷</span></summary><div class="pe-line-body grid cols-3">
      ${textEdit('原材类型', 'materials', line.rowId, 'category', line.category)}${textEdit('原材子类型', 'materials', line.rowId, 'subtype', line.subtype)}${textEdit('牌号/属性/厂商', 'materials', line.rowId, 'spec', line.spec)}${textEdit('计量单位', 'materials', line.rowId, 'unit', line.unit)}${textEdit('单价', 'materials', line.rowId, 'unitPrice', line.unitPrice, 'RMB', 'number')}${textEdit('数量', 'materials', line.rowId, 'quantity', line.quantity, line.unit, 'number')}${yesNoEdit('是否可回收', 'materials', line.rowId, 'recyclable', line.recyclable)}${textEdit('材料利用率', 'materials', line.rowId, 'utilization', line.utilization, '%', 'number')}${textEdit('回收折价率', 'materials', line.rowId, 'recycleDiscount', line.recycleDiscount, '%', 'number')}
      <button class="btn btn-del btn-sm pe-remove" data-remove-kind="materials" data-row-id="${esc(line.rowId)}">移除此材料</button>
    </div></details>`;
  }

  function renderProcesses(part, total) {
    return `<section class="panel pe-panel">${sectionHead('PROC', '生产工序', part.processes.length, total.process, '当前合计', 'processes')}
      <div class="pe-template-box"><div class="pe-template-title"><div><strong>标准工艺路线</strong><span>一键生成完整多工序组合</span></div><label><input id="pe-template-optional" type="checkbox" checked> 包含可选工序</label></div><div class="pe-adder pe-template-adder"><div class="field"><label>零件大类</label><select id="pe-template-group"></select></div><div class="field"><label>标准模板</label><select id="pe-template-id"></select></div><button class="btn btn-ghost" data-action="append-template">＋ 追加路线</button><button class="btn btn-primary" data-action="replace-template">生成工序</button></div><div id="pe-template-preview"></div></div>
      <div class="pe-divider">或逐道添加工序</div>
      <div class="pe-adder pe-process-adder"><div class="field"><label>工序大类</label><select id="pe-proc-cat"></select></div><div class="field"><label>子工序</label><select id="pe-proc-item"></select></div><button class="btn btn-primary" data-action="add-process">＋ 添加工序</button></div>
      <div class="pe-line-list pe-process-list">${part.processes.length ? part.processes.map((line, index) => renderProcessLine(line, index)).join('') : emptyLine('尚未添加工序')}</div>
    </section>`;
  }

  function renderProcessLine(line, index) {
    const cost = processCost(line);
    return `<details class="pe-line-card pe-process-card" draggable="true" data-card-row="${esc(line.rowId)}"${index === 0 ? ' open' : ''}><summary><span class="pe-drag" title="拖动调整顺序">⋮⋮</span><span class="pe-order">P${String(index + 1).padStart(2, '0')}</span><div><b>${esc(line.id)} · ${esc(line.name)}</b><em>${esc(line.category)} / ${safe(line.cycleTime)}s / ${cost.capacity.toFixed(1)} pcs/h</em></div><strong data-line-cost="processes:${esc(line.rowId)}">${money(cost.total)}</strong><span>☷</span></summary><div class="pe-line-body">
      <h4>工序与设备</h4><div class="grid cols-3">${textEdit('工序编号', 'processes', line.rowId, 'id', line.id)}${textEdit('工序大类', 'processes', line.rowId, 'category', line.category)}${textEdit('工序名称', 'processes', line.rowId, 'name', line.name)}${textEdit('设备节拍', 'processes', line.rowId, 'cycleTime', line.cycleTime, 's', 'number')}${textEdit('执行次数', 'processes', line.rowId, 'count', line.count, '次/件', 'number')}${textEdit('设备使用年限', 'processes', line.rowId, 'equipmentYears', line.equipmentYears, '年', 'number')}${textEdit('日运行时间', 'processes', line.rowId, 'dailyHours', line.dailyHours, 'h', 'number')}${textEdit('年运行天数', 'processes', line.rowId, 'annualDays', line.annualDays, '天', 'number')}${textEdit('设备总价', 'processes', line.rowId, 'equipmentPrice', line.equipmentPrice, 'RMB', 'number')}</div>
      <h4>能源与耗材</h4><div class="grid cols-3">${textEdit('电费单价', 'processes', line.rowId, 'electricityPrice', line.electricityPrice, 'RMB/kWh', 'number')}${textEdit('电耗功率', 'processes', line.rowId, 'power', line.power, 'kW', 'number')}${textEdit('燃气单价', 'processes', line.rowId, 'gasPrice', line.gasPrice, 'RMB/m³', 'number')}${textEdit('燃气能耗', 'processes', line.rowId, 'gasUsage', line.gasUsage, 'm³/h', 'number')}${textEdit('润滑油', 'processes', line.rowId, 'lubricant', line.lubricant, 'RMB/h', 'number')}${textEdit('切削油', 'processes', line.rowId, 'cuttingOil', line.cuttingOil, 'RMB/h', 'number')}${textEdit('水', 'processes', line.rowId, 'water', line.water, 'RMB/h', 'number')}${textEdit('消耗性刀具', 'processes', line.rowId, 'tools', line.tools, 'RMB/h', 'number')}${textEdit('低值易耗品', 'processes', line.rowId, 'lowValue', line.lowValue, 'RMB/h', 'number')}${textEdit('其他损耗', 'processes', line.rowId, 'otherLoss', line.otherLoss, 'RMB/h', 'number')}</div>
      <h4>人工与良率</h4><div class="grid cols-3">${textEdit('工序工人数', 'processes', line.rowId, 'workers', line.workers, '人', 'number')}${textEdit('工人月薪', 'processes', line.rowId, 'monthlySalary', line.monthlySalary, 'RMB', 'number')}${textEdit('每日工作时长', 'processes', line.rowId, 'workHours', line.workHours, 'h', 'number')}${textEdit('每月工作天数', 'processes', line.rowId, 'monthlyDays', line.monthlyDays, '天', 'number')}${textEdit('良品率', 'processes', line.rowId, 'yieldRatePct', safe(line.yieldRate) * 100, '%', 'number')}</div>
      <div class="pe-cost-strip"><span>折旧 ${money(cost.depreciation)}</span><span>电费 ${money(cost.electricity)}</span><span>燃气 ${money(cost.gas)}</span><span>耗材 ${money(cost.consumables)}</span><span>人工 ${money(cost.labor)}</span></div>
      <div class="pe-line-actions"><button class="btn btn-ghost btn-sm" data-move="up" data-row-id="${esc(line.rowId)}">↑ 上移</button><button class="btn btn-ghost btn-sm" data-move="down" data-row-id="${esc(line.rowId)}">↓ 下移</button><button class="btn btn-del btn-sm" data-remove-kind="processes" data-row-id="${esc(line.rowId)}">移除此工序</button></div>
    </div></details>`;
  }

  function renderPackaging(part, total) {
    return `<section class="panel pe-panel">${sectionHead('PACK', '包装与运输', part.packaging.length, total.packaging, '包材合计', 'packaging')}
      <div class="pe-adder pe-package-adder"><div class="field"><label>包材大类</label><select id="pe-pkg-group"></select></div><div class="field"><label>规格</label><select id="pe-pkg-item"></select></div><button class="btn btn-primary" data-action="add-packaging">＋ 添加包材</button></div>
      <div class="pe-line-list">${part.packaging.length ? part.packaging.map((line, index) => renderPackagingLine(line, index)).join('') : emptyLine('尚未添加包装')}</div>
      <div class="pe-transport grid cols-3">${basicField('单程运输费用', 'transportFee', part.basics.transportFee, 'RMB', 'number')}${basicField('单趟运输数量', 'transportQuantity', part.basics.transportQuantity, 'pcs', 'number')}<div class="result-card"><div class="k">单件运输摊销</div><div class="v" data-summary="transport">${money(total.transport)}</div></div></div>
    </section>`;
  }

  function renderPackagingLine(line, index) {
    return `<details class="pe-line-card" data-card-row="${esc(line.rowId)}"${index === 0 ? ' open' : ''}><summary><span class="pe-order">K${String(index + 1).padStart(2, '0')}</span><div><b>${esc(line.name)}</b><em>${esc(line.group)} / ${line.reusable === 'Y' ? `循环${safe(line.reuseCount)}次` : '一次性'}</em></div><strong data-line-cost="packaging:${esc(line.rowId)}">${money(packagingCost(line))}</strong><span>☷</span></summary><div class="pe-line-body grid cols-3">${textEdit('包材大类', 'packaging', line.rowId, 'group', line.group)}${textEdit('包材种类/规格', 'packaging', line.rowId, 'name', line.name)}${textEdit('包材价格', 'packaging', line.rowId, 'price', line.price, 'RMB', 'number')}${yesNoEdit('是否循环使用', 'packaging', line.rowId, 'reusable', line.reusable)}${textEdit('循环使用次数', 'packaging', line.rowId, 'reuseCount', line.reuseCount, '次', 'number')}${textEdit('每箱/容器包材用量', 'packaging', line.rowId, 'packageQuantity', line.packageQuantity, '', 'number')}${textEdit('每箱/容器零件数', 'packaging', line.rowId, 'partsPerContainer', line.partsPerContainer, 'pcs', 'number')}<button class="btn btn-del btn-sm pe-remove" data-remove-kind="packaging" data-row-id="${esc(line.rowId)}">移除此包材</button></div></details>`;
  }

  function renderSummary(part, total) {
    return `<aside class="pe-summary"><div class="panel pe-summary-card"><span>实时估算单价</span><h3 data-summary="price">${money(total.price)}</h3><div class="pe-summary-rule"></div>${summaryRow('原材料', 'material', total.material)}${summaryRow('生产工序', 'process', total.process)}${summaryRow('包装', 'packaging', total.packaging)}${summaryRow('运输', 'transport', total.transport)}<div class="pe-summary-rule"></div><div class="pe-subtotal"><span>成本合计</span><strong data-summary="subtotal">${money(total.subtotal)}</strong></div><div class="pe-margin"><span>毛利率 / 加价率</span><strong data-summary="margin">${safe(part.basics.marginRate).toFixed(1)}%</strong></div><div class="pe-formula">产品单价 = 成本合计 ×（1 + 加价率）</div><button class="btn btn-ghost" data-action="import-part">↓ 导入当前零件JSON</button><button class="btn btn-ghost" data-action="export-part-json">↑ 导出当前零件JSON</button><button class="btn btn-primary" data-action="export-part-excel">↑ 导出当前零件Excel</button><button class="btn btn-ghost" data-action="export-part-excel-en">↑ 导出当前零件英文Excel</button></div><div class="panel pe-db-stat"><strong>底库数据</strong><div><span><b>${DB.materials.length}</b>种原材料</span><span><b>${DB.processes.length}</b>道工序</span><span><b>${DB.packaging.length}</b>种包装</span><span><b>${DB.processTemplates.length}</b>套模板</span></div><p>底库只读；覆盖参数随零件保存。</p></div></aside>`;
  }

  function summaryRow(label, key, value) { return `<div class="pe-summary-row"><span>${label}</span><strong data-summary="${key}">${money(value)}</strong></div>`; }
  function emptyLine(text) { return `<div class="pe-empty">＋ ${text}<small>请从上方基础库选择并添加</small></div>`; }

  function bindEvents() {
    root.querySelectorAll('[data-open-part]').forEach((button) => button.addEventListener('click', () => { activeId = button.dataset.openPart; notice = '已切换当前零件'; renderAll(); }));
    root.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));
    root.querySelectorAll('[data-clear]').forEach((button) => button.addEventListener('click', () => clearLines(button.dataset.clear)));
    root.querySelectorAll('[data-remove-kind]').forEach((button) => button.addEventListener('click', () => removeLine(button.dataset.removeKind, button.dataset.rowId)));
    root.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => moveProcess(button.dataset.rowId, button.dataset.move === 'up' ? -1 : 1)));
    root.querySelectorAll('[data-basic]').forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => updateBasic(input)));
    root.querySelectorAll('[data-line-kind]').forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => updateLine(input)));
    document.getElementById('pe-project-name').addEventListener('input', (event) => { project.projectName = event.target.value; saveProject(); });
    document.getElementById('pe-project-file').addEventListener('change', (event) => importProjectFile(event.target.files[0], event.target));
    document.getElementById('pe-part-file').addEventListener('change', (event) => importPartFile(event.target.files[0], event.target));
    bindDrag();
  }

  function updateBasic(input) {
    const part = activePart();
    const numeric = input.type === 'number';
    part.basics[input.dataset.basic] = numeric ? safe(Number(input.value)) : input.value;
    touchPart(part);
    refreshLive();
  }

  function updateLine(input) {
    const part = activePart();
    const kind = input.dataset.lineKind;
    const line = part[kind].find((item) => item.rowId === input.dataset.rowId);
    if (!line) return;
    const key = input.dataset.lineKey;
    if (key === 'yieldRatePct') line.yieldRate = safe(Number(input.value)) / 100;
    else line[key] = input.type === 'number' ? safe(Number(input.value)) : input.value;
    touchPart(part);
    refreshLive();
  }

  function refreshLive() {
    const part = activePart();
    const total = totals(part);
    const values = { material: total.material, process: total.process, packaging: total.packaging, transport: total.transport, subtotal: total.subtotal, price: total.price };
    Object.keys(values).forEach((key) => root.querySelectorAll(`[data-summary="${key}"]`).forEach((el) => { el.textContent = money(values[key]); }));
    root.querySelectorAll('[data-module-total]').forEach((el) => { el.textContent = money(values[el.dataset.moduleTotal === 'materials' ? 'material' : el.dataset.moduleTotal === 'processes' ? 'process' : 'packaging']); });
    const margin = root.querySelector('[data-summary="margin"]'); if (margin) margin.textContent = `${safe(part.basics.marginRate).toFixed(1)}%`;
    part.materials.forEach((line) => setLineCost('materials', line.rowId, materialCost(line)));
    part.processes.forEach((line) => setLineCost('processes', line.rowId, processCost(line).total));
    part.packaging.forEach((line) => setLineCost('packaging', line.rowId, packagingCost(line)));
    project.parts.forEach((item) => {
      const tab = root.querySelector(`[data-open-part="${selectorValue(item.id)}"] strong:last-child`);
      if (tab) tab.textContent = money(totals(item).price);
    });
  }

  function setLineCost(kind, rowId, value) {
    const el = root.querySelector(`[data-line-cost="${selectorValue(`${kind}:${rowId}`)}"]`);
    if (el) el.textContent = money(value);
  }

  function initAdders() {
    const matCats = unique(DB.materials.map((item) => item.category));
    fillSelect('pe-mat-cat', matCats.map((value) => [value, value]));
    const updateMaterialSubtype = () => {
      const category = document.getElementById('pe-mat-cat').value;
      const subs = unique(DB.materials.filter((item) => item.category === category).map((item) => item.subtype));
      fillSelect('pe-mat-sub', subs.map((value) => [value, value])); updateMaterialItem();
    };
    const updateMaterialItem = () => {
      const category = document.getElementById('pe-mat-cat').value;
      const subtype = document.getElementById('pe-mat-sub').value;
      const items = DB.materials.filter((item) => item.category === category && item.subtype === subtype);
      fillSelect('pe-mat-item', items.map((item) => [item.id, item.spec || '/'])); updateAreaHint();
    };
    document.getElementById('pe-mat-cat').addEventListener('change', updateMaterialSubtype);
    document.getElementById('pe-mat-sub').addEventListener('change', updateMaterialItem);
    document.getElementById('pe-mat-item').addEventListener('change', updateAreaHint);
    updateMaterialSubtype();

    const procCats = unique(DB.processes.map((item) => item.category));
    fillSelect('pe-proc-cat', procCats.map((value) => [value, value]));
    const updateProcessItem = () => {
      const category = document.getElementById('pe-proc-cat').value;
      const items = DB.processes.filter((item) => item.category === category);
      fillSelect('pe-proc-item', items.map((item) => [item.id, `${item.id} · ${item.name}`]));
    };
    document.getElementById('pe-proc-cat').addEventListener('change', updateProcessItem); updateProcessItem();

    const pkgGroups = unique(DB.packaging.map((item) => item.group));
    fillSelect('pe-pkg-group', pkgGroups.map((value) => [value, value]));
    const updatePackagingItem = () => {
      const group = document.getElementById('pe-pkg-group').value;
      const items = DB.packaging.filter((item) => item.group === group);
      fillSelect('pe-pkg-item', items.map((item) => [item.id, item.name]));
    };
    document.getElementById('pe-pkg-group').addEventListener('change', updatePackagingItem); updatePackagingItem();
  }

  function fillSelect(id, options) {
    const select = document.getElementById(id);
    select.innerHTML = options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  }

  function updateAreaHint() {
    const item = DB.materials.find((entry) => entry.id === document.getElementById('pe-mat-item').value);
    const hint = document.getElementById('pe-area-hint');
    if (!item || item.unit !== 'm2') { hint.textContent = ''; return; }
    const area = Math.max(0, safe(activePart().basics.surfaceArea)) / 1000000;
    hint.textContent = `面积材料将按零件表面积自动带入：${area > 0 ? `${area.toFixed(6)} m²` : '请先填写零件表面积'}；添加后仍可修改数量和利用率。`;
  }

  function initTemplatePicker() {
    const groups = unique(DB.processTemplates.map((item) => item.group));
    fillSelect('pe-template-group', groups.map((value) => [value, value]));
    const updateTemplates = () => {
      const group = document.getElementById('pe-template-group').value;
      const items = DB.processTemplates.filter((item) => item.group === group);
      fillSelect('pe-template-id', items.map((item) => [item.id, `${item.name} · ${item.steps.length}道`])); updateTemplatePreview();
    };
    document.getElementById('pe-template-group').addEventListener('change', updateTemplates);
    document.getElementById('pe-template-id').addEventListener('change', updateTemplatePreview);
    document.getElementById('pe-template-optional').addEventListener('change', updateTemplatePreview);
    updateTemplates();
  }

  function selectedTemplate() { return DB.processTemplates.find((item) => item.id === document.getElementById('pe-template-id').value); }
  function updateTemplatePreview() {
    const template = selectedTemplate(); if (!template) return;
    const optional = document.getElementById('pe-template-optional').checked;
    const steps = template.steps.filter((step) => optional || step.required);
    document.getElementById('pe-template-preview').innerHTML = `<div class="pe-template-desc"><b>${esc(template.name)}</b><span>${esc(template.description)}</span></div><div class="pe-route">${steps.map((step, index) => `<span class="${step.required ? '' : 'optional'}"><b>${index + 1}</b>${esc(step.name)}</span>`).join('')}</div>`;
  }

  function handleAction(action) {
    const part = activePart();
    if (action === 'add-part') {
      const item = createPart(project.parts.length + 1); project.parts.push(item); activeId = item.id; notice = '已新建零件估价'; saveProject(); renderAll();
    } else if (action === 'duplicate-part') {
      const copy = deepClone(part); const now = new Date().toISOString(); copy.id = uid(); copy.createdAt = now; copy.updatedAt = now; copy.basics.partNo += '-COPY'; copy.basics.partName += ' 副本'; ['materials', 'processes', 'packaging'].forEach((kind) => copy[kind].forEach((line) => { line.rowId = uid(); })); project.parts.push(copy); activeId = copy.id; notice = '已复制当前零件'; saveProject(); renderAll();
    } else if (action === 'delete-part') {
      if (project.parts.length === 1) return alert('项目至少需要保留一个零件。');
      if (!confirm(`确定删除“${part.basics.partName}”吗？`)) return;
      project.parts = project.parts.filter((item) => item.id !== part.id); activeId = project.parts[0].id; notice = '零件已删除'; saveProject(); renderAll();
    } else if (action === 'add-material') addMaterial();
    else if (action === 'add-process') addProcess();
    else if (action === 'add-packaging') addPackaging();
    else if (action === 'append-template') applyTemplate(false);
    else if (action === 'replace-template') applyTemplate(true);
    else if (action === 'import-project') document.getElementById('pe-project-file').click();
    else if (action === 'import-part') document.getElementById('pe-part-file').click();
    else if (action === 'export-project-json') exportJson(project, project.projectName || '零件估价项目');
    else if (action === 'export-part-json') exportJson({ ...project, projectName: `${project.projectName}-${part.basics.partNo}`, parts: [part] }, `${part.basics.partNo}-${part.basics.partName}`);
    else if (action === 'export-project-excel-en') exportExcel(project.parts, project.projectName || 'Part_Estimate', 'en');
    else if (action === 'export-part-excel-en') exportExcel([part], `${part.basics.partNo}-${part.basics.partName}`, 'en');
    else if (action === 'export-project-excel') exportExcel(project.parts, project.projectName || '零件估价项目');
    else if (action === 'export-part-excel') exportExcel([part], `${part.basics.partNo}-${part.basics.partName}`);
  }

  function addMaterial() {
    const item = DB.materials.find((entry) => entry.id === document.getElementById('pe-mat-item').value); if (!item) return;
    const quantity = item.unit === 'm2' && safe(activePart().basics.surfaceArea) > 0 ? safe(activePart().basics.surfaceArea) / 1000000 : 1;
    activePart().materials.push({ ...deepClone(item), rowId: uid(), quantity }); notice = `已添加材料：${item.subtype}`; touchPart(activePart()); renderAll();
  }
  function addProcess() {
    const category = document.getElementById('pe-proc-cat').value;
    const item = DB.processes.find((entry) => entry.category === category && entry.id === document.getElementById('pe-proc-item').value); if (!item) return;
    activePart().processes.push({ ...deepClone(item), rowId: uid(), count: 1 }); notice = `已添加工序：${item.name}`; touchPart(activePart()); renderAll();
  }
  function addPackaging() {
    const item = DB.packaging.find((entry) => entry.id === document.getElementById('pe-pkg-item').value); if (!item) return;
    activePart().packaging.push({ ...deepClone(item), rowId: uid(), packageQuantity: 1, partsPerContainer: 1 }); notice = `已添加包材：${item.name}`; touchPart(activePart()); renderAll();
  }

  function applyTemplate(replace) {
    const template = selectedTemplate(); if (!template) return;
    const part = activePart();
    if (replace && part.processes.length && !confirm(`将用“${template.name}”替换当前${part.processes.length}道工序，是否继续？`)) return;
    const optional = document.getElementById('pe-template-optional').checked;
    const steps = template.steps.filter((step) => optional || step.required);
    const lines = steps.map((step) => {
      const item = DB.processes.find((proc) => proc.category === step.category && proc.id === step.processId);
      return item ? { ...deepClone(item), rowId: uid(), count: step.count } : null;
    }).filter(Boolean);
    part.processes = replace ? lines : part.processes.concat(lines);
    if (replace) part.basics.processDescription = template.name;
    notice = `已${replace ? '载入' : '追加'}“${template.name}”${lines.length}道工序`;
    touchPart(part); renderAll();
  }

  function clearLines(kind) {
    const part = activePart(); const label = kind === 'materials' ? '原材料' : kind === 'processes' ? '工序' : '包材';
    if (!part[kind].length) return alert(`当前没有可清除的${label}。`);
    if (!confirm(`确定清除当前零件的全部${label}吗？此操作无法撤销。`)) return;
    part[kind] = []; notice = `已清除当前零件的全部${label}`; touchPart(part); renderAll();
  }
  function removeLine(kind, rowId) { const part = activePart(); part[kind] = part[kind].filter((line) => line.rowId !== rowId); notice = '已移除明细'; touchPart(part); renderAll(); }
  function moveProcess(rowId, delta) {
    const lines = activePart().processes; const index = lines.findIndex((line) => line.rowId === rowId); const target = index + delta;
    if (index < 0 || target < 0 || target >= lines.length) return;
    const item = lines.splice(index, 1)[0]; lines.splice(target, 0, item); notice = '工序顺序已更新'; touchPart(activePart()); renderAll();
  }

  function bindDrag() {
    root.querySelectorAll('.pe-process-card').forEach((card) => {
      card.addEventListener('dragstart', (event) => { dragRowId = card.dataset.cardRow; card.classList.add('dragging'); event.dataTransfer.effectAllowed = 'move'; });
      card.addEventListener('dragend', () => { dragRowId = null; card.classList.remove('dragging'); root.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over')); });
      card.addEventListener('dragover', (event) => { event.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (event) => {
        event.preventDefault(); card.classList.remove('drag-over');
        const targetId = card.dataset.cardRow; if (!dragRowId || dragRowId === targetId) return;
        const lines = activePart().processes; const from = lines.findIndex((line) => line.rowId === dragRowId); const to = lines.findIndex((line) => line.rowId === targetId);
        if (from < 0 || to < 0) return; const item = lines.splice(from, 1)[0]; lines.splice(to, 0, item); notice = '工序顺序已更新'; touchPart(activePart()); renderAll();
      });
    });
  }

  function download(content, filename, type) {
    const blob = new Blob([content], { type: type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function safeFileName(name) { return String(name || '估价项目').replace(/[\\/:*?"<>|]/g, '-'); }
  function exportJson(value, name) { download(JSON.stringify({ ...value, exportedAt: new Date().toISOString() }, null, 2), `${safeFileName(name)}.json`, 'application/json;charset=utf-8'); }

  async function importProjectFile(file, input) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); if (!validProject(parsed)) throw new Error('invalid');
      if (!confirm(`导入整个项目将替换当前全部${project.parts.length}个零件，是否继续？`)) return;
      project = normalizeProject(parsed); activeId = project.parts[0].id; notice = `已导入整个项目，共${project.parts.length}个零件`; saveProject(); renderAll();
    } catch (error) { alert('项目导入失败：请选择本工具导出的项目JSON文件。'); }
    finally { input.value = ''; }
  }
  async function importPartFile(file, input) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); if (!validProject(parsed)) throw new Error('invalid');
      const imported = normalizeProject(parsed).parts[0]; if (!imported.basics || !Array.isArray(imported.materials) || !Array.isArray(imported.processes) || !Array.isArray(imported.packaging)) throw new Error('invalid');
      const current = activePart(); if (!confirm(`导入将替换当前零件“${current.basics.partName}”，不会影响项目中的其他零件，是否继续？`)) return;
      const replacement = deepClone(imported); replacement.id = current.id; replacement.createdAt = current.createdAt; replacement.updatedAt = new Date().toISOString(); ['materials', 'processes', 'packaging'].forEach((kind) => replacement[kind].forEach((line) => { line.rowId = uid(); }));
      project.parts = project.parts.map((item) => item.id === current.id ? replacement : item); notice = `已导入当前零件：${replacement.basics.partName}`; saveProject(); renderAll();
    } catch (error) { alert('零件导入失败：请选择由“导出当前零件JSON”生成的文件。'); }
    finally { input.value = ''; }
  }

  function safeSheetName(name, index, used) {
    const base = String(name || `零件${index + 1}`).replace(/[\\/?*\[\]:]/g, '-').slice(0, 28) || `零件${index + 1}`;
    let value = base; let suffix = 1; while (used.has(value)) value = `${base.slice(0, 25)}-${suffix++}`; used.add(value); return value;
  }
  function partRows(part, lang = 'zh') {
    const r = T.reportLanguage(lang);
    const t = totals(part);
    return [
      [r('汽车零件模块化估价结果')], [r('零件号'), part.basics.partNo, r('零件名称'), part.basics.partName], [r('加工工艺'), part.basics.processDescription, r('外形尺寸/mm'), part.basics.dimensions], [r('是否开模'), part.basics.moldRequired, r('模具腔数'), part.basics.cavities, r('表面积/mm²'), part.basics.surfaceArea], [],
      [r('成本汇总'), r('金额 / RMB')], [r('原材料'), t.material], [r('工序'), t.process], [r('包装'), t.packaging], [r('运输'), t.transport], [r('成本合计'), t.subtotal], [r('毛利率/加价率'), part.basics.marginRate / 100], [r('估算单价'), t.price], [],
      [r('原材料明细')], [r('类别'), r('子类型'), r('牌号/属性'), r('单位'), r('单价'), r('数量'), r('可回收'), r('利用率'), r('回收折价率'), r('成本')], ...part.materials.map((line) => [line.category, line.subtype, line.spec, line.unit, line.unitPrice, line.quantity, line.recyclable, line.utilization / 100, line.recycleDiscount / 100, materialCost(line)]), [],
      [r('工序明细')], [r('编号'), r('工序大类'), r('工序名称'), r('节拍/s'), r('设备价'), r('功率/kW'), r('工人数'), r('月薪'), r('良率'), r('次数'), r('单次成本'), r('合计')], ...part.processes.map((line) => { const c = processCost(line); return [line.id, line.category, line.name, line.cycleTime, line.equipmentPrice, line.power, line.workers, line.monthlySalary, line.yieldRate, line.count, c.unitCost, c.total]; }), [],
      [r('包装明细')], [r('分组'), r('包材种类'), r('包材价格'), r('循环使用'), r('循环次数'), r('每箱/容器用量'), r('每箱零件数'), r('单件摊销')], ...part.packaging.map((line) => [line.group, line.name, line.price, line.reusable, line.reuseCount, line.packageQuantity, line.partsPerContainer, packagingCost(line)]), [],
      [r('运输明细')], [r('单程运输费用'), part.basics.transportFee, r('单趟运输数量'), part.basics.transportQuantity, r('单件运输摊销'), t.transport],
    ];
  }
  function exportExcel(parts, name, lang = 'zh') {
    const r = T.reportLanguage(lang);
    if (!window.XLSX) return alert(r('Excel导出组件未加载，请确认 js/vendor/xlsx.min.js 文件存在。'));
    const wb = XLSX.utils.book_new(); const used = new Set();
    const summary = [[r('零件号'), r('零件名称'), r('原材料'), r('工序'), r('包装'), r('运输'), r('成本合计'), r('毛利率/加价率'), r('估算单价')]];
    parts.forEach((part) => { const t = totals(part); summary.push([part.basics.partNo, part.basics.partName, t.material, t.process, t.packaging, t.transport, t.subtotal, part.basics.marginRate / 100, t.price]); });
    const summarySheet = XLSX.utils.aoa_to_sheet(summary); summarySheet['!cols'] = [{wch:18},{wch:24},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14},{wch:16},{wch:14}]; XLSX.utils.book_append_sheet(wb, summarySheet, r('项目汇总')); used.add(r('项目汇总'));
    parts.forEach((part, index) => { const sheet = XLSX.utils.aoa_to_sheet(partRows(part, lang)); sheet['!cols'] = Array.from({length:12}, (_, i) => ({wch: i < 3 ? 22 : 15})); XLSX.utils.book_append_sheet(wb, sheet, safeSheetName(`${part.basics.partNo}-${part.basics.partName}`, index, used)); });
    XLSX.writeFile(wb, `${safeFileName(name)}${lang === 'en' ? '_EN' : ''}.xlsx`);
  }
})();
