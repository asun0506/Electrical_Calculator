/**
 * SOR 模板生成器
 * 直接修改公开 DOCX 模板中的标黄字段，保留页眉、页脚、样式、图片与 A4 页面设置。
 */
(function () {
  'use strict';

  const E = window.ElUtil;
  const TEMPLATE = window.SOR_TEMPLATE_DATA;
  if (!TEMPLATE || !window.JSZip) return;

  const schema = TEMPLATE.schema;
  const fieldById = Object.fromEntries(schema.fields.map((item) => [item.id, item]));
  const tableById = Object.fromEntries(schema.tables.map((item) => [item.id, item]));
  const uiSections = schema.sections;
  let state;
  let hostRef;
  let previewHost;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    const fields = {};
    const tables = {};
    schema.fields.forEach((field) => { fields[field.id] = field.default; });
    schema.tables.forEach((table) => { tables[table.id] = normalizeSequenceRows(table, clone(table.defaults)); });
    return {
      formatVersion: 3,
      templateSha256: schema.sourceSha256,
      meta: {
        fileName: '项目_SOR',
        documentHeader: '按封面SOR编号与版本自动生成',
      },
      fields,
      tables,
      cellImages: {},
      attachments: [],
    };
  }

  function normalizeFileName(value, ext) {
    const safe = String(value || 'SOR').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\.+$/g, '') || 'SOR';
    return safe.toLowerCase().endsWith(ext) ? safe : safe + ext;
  }

  function esc(value) {
    return E.escapeHtml(value == null ? '' : String(value));
  }

  function fieldControl(field) {
    const value = state.fields[field.id] == null ? '' : state.fields[field.id];
    const common = `data-sor-field="${esc(field.id)}" aria-label="${esc(field.label)}"`;
    if (field.type === 'textarea') {
      return `<textarea ${common} rows="4">${esc(value)}</textarea>`;
    }
    return `<input ${common} type="text" value="${esc(value)}">`;
  }

  function sectionProgress(section) {
    const total = section.fieldIds.length + section.tableIds.length;
    let complete = 0;
    section.fieldIds.forEach((id) => { if (String(state.fields[id] || '').trim()) complete += 1; });
    section.tableIds.forEach((id) => {
      const table = tableById[id];
      const rows = state.tables[id] || [];
      const hasValue = rows.some((row) => row.some((cell) => String(cell || '').trim()))
        || Object.keys(state.cellImages || {}).some((key) => key.startsWith(`${table.id}:`));
      if (hasValue) complete += 1;
    });
    return { total, complete };
  }

  function cellImageKey(tableId, row, col) {
    return `${tableId}:${row}:${col}`;
  }

  function cellEditor(table, row, col, header, value) {
    const key = cellImageKey(table.id, row, col);
    const image = state.cellImages?.[key];
    const textarea = `<textarea rows="2" data-table-id="${esc(table.id)}" data-row="${row}" data-col="${col}" aria-label="${esc(header)}">${esc(value || '')}</textarea>`;
    const imageEnabled = (table.imageColumns || []).includes(col)
      || (table.imageCells || []).some((cell) => cell[0] === row && cell[1] === col);
    if (!imageEnabled) return textarea;
    return `<div class="sor-image-cell">${textarea}
      <div class="sor-image-control">${image ? `<img src="${esc(image.dataUrl)}" alt="${esc(image.name)}"><span>${esc(image.name)}</span><button type="button" data-remove-cell-image="${esc(key)}">移除图片</button>` : `<label class="btn sor-file-btn">插入图片<input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" data-cell-image="${esc(key)}"></label><small>图片将插入 Word/PDF 中的此处</small>`}</div>
    </div>`;
  }

  function isSequenceHeader(header) {
    const normalized = String(header || '').replace(/[\s._/-]+/g, '').toLowerCase();
    return normalized.includes('序号') || ['no', 'number'].includes(normalized);
  }

  function tableColumnClass(header) {
    return isSequenceHeader(header) ? 'sor-col-index' : '';
  }

  function sequenceValue(table, rows, column, rowIndex) {
    const number = rowIndex + 1;
    const example = rows.map((row) => String(row?.[column] || '').trim()).find(Boolean)
      || (table.defaults || []).map((row) => String(row?.[column] || '').trim()).find(Boolean);
    const match = /^(.*?)(\d+)(\D*)$/.exec(example || '');
    if (!match) return String(number);
    const digits = String(number).padStart(match[2].length, '0');
    return `${match[1]}${digits}${match[3]}`;
  }

  function normalizeSequenceRows(table, sourceRows, overwrite = true) {
    const rows = Array.isArray(sourceRows) && sourceRows.length
      ? sourceRows.map((row) => table.headers.map((header, column) => row?.[column] == null ? '' : row[column]))
      : [table.headers.map(() => '')];
    table.headers.forEach((header, column) => {
      if (!isSequenceHeader(header)) return;
      rows.forEach((row, rowIndex) => {
        if (overwrite || !String(row[column] || '').trim()) row[column] = sequenceValue(table, rows, column, rowIndex);
      });
    });
    return rows;
  }

  function newTableRow(table, rows) {
    const row = table.headers.map(() => '');
    table.headers.forEach((header, column) => {
      if (isSequenceHeader(header)) row[column] = sequenceValue(table, rows, column, rows.length);
    });
    return row;
  }

  function tableEditor(table) {
    const rows = state.tables[table.id] || [];
    const columnClasses = table.headers.map(tableColumnClass);
    return `<div class="sor-table-block sor-repeatable-table" data-sor-table="${esc(table.id)}">
      <div class="sor-table-heading">
        <div><span class="sor-chapter-badge">${table.chapterNumber === '封面' ? '封面' : `章节 ${esc(table.chapterNumber)}`}</span><strong>${esc(table.title)}</strong><p>${esc(table.hint)}</p><small class="sor-paste-hint">支持从 Excel 或其他表格复制多行、多列，并从选中的单元格直接粘贴。</small></div>
        <button type="button" class="btn sor-add-row" data-table-id="${esc(table.id)}">添加一行</button>
      </div>
      <div class="sor-table-scroll"><table class="sor-editor-table"><colgroup>${columnClasses.map((className) => `<col class="${className}">`).join('')}<col class="sor-col-action"></colgroup><thead><tr>${table.headers.map((header, ci) => `<th class="${columnClasses[ci]}">${esc(header)}</th>`).join('')}<th class="sor-action-col">操作</th></tr></thead>
      <tbody>${rows.map((row, ri) => `<tr>${table.headers.map((header, ci) => `<td class="${columnClasses[ci]}">${cellEditor(table, ri, ci, header, row[ci])}</td>`).join('')}<td class="sor-action-col"><button type="button" class="sor-delete-row" data-table-id="${esc(table.id)}" data-row="${ri}" title="删除本行">×</button></td></tr>`).join('')}</tbody></table></div>
    </div>`;
  }

  function captureOpenSections() {
    return new Set(Array.from(hostRef?.querySelectorAll('details[open]') || []).map((item) => item.dataset.sectionId));
  }

  function render(openSectionIds) {
    const openIds = openSectionIds || captureOpenSections();
    const sectionsHtml = uiSections.map((section, index) => {
      const progress = sectionProgress(section);
      const items = (section.items || [
        ...section.fieldIds.map((id) => ({ type: 'field', id })),
        ...section.tableIds.map((id) => ({ type: 'table', id })),
      ]).map((item) => item.type === 'field' ? fieldById[item.id] : tableById[item.id]).filter(Boolean);
      if (!items.length) return '';
      return `<details class="sor-section" data-section-id="${esc(section.id)}" ${(openIds.has(section.id) || (index === 0 && !openIds.size)) ? 'open' : ''}>
        <summary><span><b>${esc(section.title)}</b><small>${esc(section.description)}</small></span><em>${progress.complete}/${progress.total}</em></summary>
        <div class="sor-section-body">
          <div class="sor-section-tools"><button type="button" class="btn sor-fill-section" data-section-id="${esc(section.id)}">本章一键填充模板默认信息</button></div>
          ${items.map((item) => item.token
            ? `<label class="sor-field"><span><em class="sor-chapter-badge">${item.chapterNumber === '封面' ? '封面' : `章节 ${esc(item.chapterNumber)}`}</em>${esc(item.label)}</span>${fieldControl(item)}<small>${esc(item.hint)}</small></label>`
            : tableEditor(item)).join('')}
        </div>
      </details>`;
    }).join('');

    hostRef.innerHTML = `<style>${moduleStyle()}</style>
      <section class="panel sor-hero">
        <div><p class="sor-kicker">公开版 SOR Template · A4 原版生成</p><h3>SOR 项目文件生成器</h3><p>填写项按大章节归类并依章节号排列；所有表格均可增减行，目录无需输入。</p></div>
        <div class="sor-actions">
          <button type="button" class="btn" id="sorExportJson">导出 JSON</button>
          <label class="btn sor-file-btn">导入 JSON<input id="sorImportJson" type="file" accept="application/json,.json"></label>
          <button type="button" class="btn danger" id="sorClear">一键清空</button>
          <button type="button" class="btn primary" id="sorWord">生成 Word</button>
          <button type="button" class="btn primary" id="sorPdf">打印 / 导出 PDF</button>
        </div>
      </section>

      <section class="panel sor-meta">
        <label><span>导出文件名称</span><input id="sorFileName" value="${esc(state.meta.fileName)}" placeholder="例如：NS22_BMU_SOR_V1.0"></label>
        <label><span>页眉生成方式</span><input value="封面 SOR 编号 + 版本号（自动同步）" disabled></label>
        <div class="sor-template-fact"><span>模板</span><strong>${esc(schema.templateName)}</strong><small>原文件 ${esc(schema.pageCount)} 页 · A4 纵向 · 可公开模板 · 数据仅在本地浏览器处理</small></div>
      </section>

      <section class="panel sor-guide">
        <h3>未标黄但建议确认的项目</h3>
        <p>以下内容在模板中没有统一标黄，但针对具体项目通常仍需要核对：</p>
        <ul>${schema.optionalCandidates.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      </section>

      <section class="panel sor-attachments">
        <div class="sor-attachment-head"><div><h3>附件</h3><p>图片会插入 Word/PDF 附件页；其他文件会随 JSON 保存，并在报告中列出文件名、类型和大小。</p></div>
          <label class="btn sor-file-btn">添加附件<input id="sorAttachmentInput" type="file" multiple></label></div>
        <div class="sor-attachment-category">
          <label>附件类别<select id="sorAttachmentCategory"><option>2D图纸</option><option>3D数模</option><option>EID</option><option>产品/结构图片</option><option>接口定义</option><option>测试报告</option><option>其他</option></select></label>
          <label>附件说明<input id="sorAttachmentNote" placeholder="例如：BMU总成3D数模，V5.2"></label>
        </div>
        <div class="sor-attachment-list">${state.attachments.length ? state.attachments.map((file, index) => `<div class="sor-attachment-item"><span>${file.dataUrl.startsWith('data:image/') ? `<img src="${esc(file.dataUrl)}" alt="">` : '<b>FILE</b>'}</span><div><strong>${esc(file.name)}</strong><small>${esc(file.category)} · ${esc(file.note || '无说明')} · ${formatBytes(file.size)}</small></div><button type="button" data-remove-attachment="${index}">×</button></div>`).join('') : '<p class="empty-tip">尚未添加附件</p>'}</div>
      </section>

      <div class="sor-sections">${sectionsHtml}</div>
      <div id="sorPreviewShell" class="sor-preview-shell" aria-hidden="true"><div class="sor-preview-toolbar"><span>PDF打印预览（A4）</span><button type="button" id="sorClosePreview">关闭预览</button></div><div id="sorDocxPreview" class="sor-docx-preview"></div></div>`;
    previewHost = hostRef.querySelector('#sorDocxPreview');
    bindEvents();
  }

  function bindEvents() {
    hostRef.querySelectorAll('[data-sor-field]').forEach((input) => input.addEventListener('input', () => { state.fields[input.dataset.sorField] = input.value; }));
    hostRef.querySelectorAll('textarea[data-table-id]').forEach((input) => input.addEventListener('input', () => {
      state.tables[input.dataset.tableId][Number(input.dataset.row)][Number(input.dataset.col)] = input.value;
    }));
    hostRef.querySelectorAll('textarea[data-table-id]').forEach((input) => input.addEventListener('paste', pasteTableCells));
    hostRef.querySelector('#sorFileName').addEventListener('input', (event) => { state.meta.fileName = event.target.value; });
    hostRef.querySelectorAll('.sor-add-row').forEach((button) => button.addEventListener('click', () => {
      const table = tableById[button.dataset.tableId];
      const openIds = captureOpenSections();
      openIds.add(table.sectionId);
      state.tables[table.id].push(newTableRow(table, state.tables[table.id]));
      render(openIds);
    }));
    hostRef.querySelectorAll('.sor-delete-row').forEach((button) => button.addEventListener('click', () => {
      const tableId = button.dataset.tableId;
      const rowIndex = Number(button.dataset.row);
      const rows = state.tables[tableId];
      const openIds = captureOpenSections();
      openIds.add(tableById[tableId].sectionId);
      rows.splice(rowIndex, 1);
      shiftCellImagesAfterDelete(tableId, rowIndex);
      if (!rows.length) rows.push(newTableRow(tableById[tableId], rows));
      state.tables[tableId] = normalizeSequenceRows(tableById[tableId], rows);
      render(openIds);
    }));
    hostRef.querySelectorAll('[data-cell-image]').forEach((input) => input.addEventListener('change', importCellImage));
    hostRef.querySelectorAll('[data-remove-cell-image]').forEach((button) => button.addEventListener('click', () => {
      const openIds = captureOpenSections();
      delete state.cellImages[button.dataset.removeCellImage];
      render(openIds);
    }));
    hostRef.querySelectorAll('.sor-fill-section').forEach((button) => button.addEventListener('click', () => fillSection(button.dataset.sectionId)));
    hostRef.querySelectorAll('[data-remove-attachment]').forEach((button) => button.addEventListener('click', () => { state.attachments.splice(Number(button.dataset.removeAttachment), 1); render(); }));
    hostRef.querySelector('#sorAttachmentInput').addEventListener('change', importAttachments);
    hostRef.querySelector('#sorExportJson').addEventListener('click', exportJson);
    hostRef.querySelector('#sorImportJson').addEventListener('change', importJson);
    hostRef.querySelector('#sorClear').addEventListener('click', clearAll);
    hostRef.querySelector('#sorWord').addEventListener('click', exportWord);
    hostRef.querySelector('#sorPdf').addEventListener('click', exportPdf);
    hostRef.querySelector('#sorClosePreview').addEventListener('click', closePreview);
  }

  function parseClipboardTable(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === '\t' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[index + 1] === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell);
    rows.push(row);
    while (rows.length > 1 && rows[rows.length - 1].every((value) => value === '')) rows.pop();
    return rows;
  }

  function pasteTableCells(event) {
    const text = event.clipboardData?.getData('text/plain');
    if (!text || (!text.includes('\t') && !/[\r\n]/.test(text))) return;
    const grid = parseClipboardTable(text);
    if (!grid.length) return;
    event.preventDefault();
    const tableId = event.currentTarget.dataset.tableId;
    const table = tableById[tableId];
    const startRow = Number(event.currentTarget.dataset.row);
    const startColumn = Number(event.currentTarget.dataset.col);
    const rows = state.tables[tableId];
    const requiredRows = startRow + grid.length;
    while (rows.length < requiredRows) rows.push(newTableRow(table, rows));
    grid.forEach((values, rowOffset) => {
      values.forEach((value, columnOffset) => {
        const column = startColumn + columnOffset;
        if (column < table.headers.length) rows[startRow + rowOffset][column] = value;
      });
    });
    state.tables[tableId] = normalizeSequenceRows(table, rows, false);
    const openIds = captureOpenSections();
    openIds.add(table.sectionId);
    render(openIds);
  }

  function fillSection(sectionId) {
    const section = uiSections.find((item) => item.id === sectionId);
    if (!section) return;
    section.fieldIds.forEach((id) => { state.fields[id] = fieldById[id].default; });
    section.tableIds.forEach((id) => { state.tables[id] = normalizeSequenceRows(tableById[id], clone(tableById[id].defaults)); });
    Object.keys(state.cellImages || {}).forEach((key) => {
      if (section.tableIds.some((id) => key.startsWith(`${id}:`))) delete state.cellImages[key];
    });
    render(new Set([sectionId]));
  }

  function clearAll() {
    if (!window.confirm('确认清空当前 SOR 校核内容、表格行和全部附件吗？此操作无法撤销；建议先导出 JSON 备份。')) return;
    state = defaultState();
    Object.keys(state.fields).forEach((id) => { state.fields[id] = ''; });
    Object.keys(state.tables).forEach((id) => {
      const table = tableById[id];
      state.tables[id] = normalizeSequenceRows(table, [table.headers.map(() => '')]);
    });
    state.cellImages = {};
    state.attachments = [];
    state.meta.fileName = '新建_SOR';
    render();
  }

  function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function readFileDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function readImageSize(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 800, height: image.naturalHeight || 450 });
      image.onerror = () => resolve({ width: 800, height: 450 });
      image.src = dataUrl;
    });
  }

  async function importCellImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      window.alert('表格内图片请使用 PNG 或 JPG 格式。');
      event.target.value = '';
      return;
    }
    const openIds = captureOpenSections();
    const dataUrl = await readFileDataUrl(file);
    const size = await readImageSize(dataUrl);
    state.cellImages[event.target.dataset.cellImage] = {
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl,
      width: size.width,
      height: size.height,
    };
    render(openIds);
  }

  function shiftCellImagesAfterDelete(tableId, deletedRow) {
    const next = {};
    Object.entries(state.cellImages || {}).forEach(([key, value]) => {
      const [keyTable, rowText, colText] = key.split(':');
      if (keyTable !== tableId) {
        next[key] = value;
        return;
      }
      const row = Number(rowText);
      if (row < deletedRow) next[key] = value;
      else if (row > deletedRow) next[cellImageKey(tableId, row - 1, Number(colText))] = value;
    });
    state.cellImages = next;
  }

  async function importAttachments(event) {
    const category = hostRef.querySelector('#sorAttachmentCategory').value;
    const note = hostRef.querySelector('#sorAttachmentNote').value.trim();
    for (const file of Array.from(event.target.files || [])) {
      state.attachments.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, category, note, dataUrl: await readFileDataUrl(file) });
    }
    render();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJson() {
    const payload = { ...state, exportedAt: new Date().toISOString(), schemaVersion: schema.version };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), normalizeFileName(state.meta.fileName, '.json'));
  }

  async function importJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.fields || !data.tables) throw new Error('文件中缺少 SOR 字段或表格数据');
      const next = defaultState();
      next.meta = { ...next.meta, ...(data.meta || {}) };
      Object.keys(next.fields).forEach((id) => { if (Object.prototype.hasOwnProperty.call(data.fields, id)) next.fields[id] = data.fields[id]; });
      Object.keys(next.tables).forEach((id) => {
        if (Array.isArray(data.tables[id])) next.tables[id] = normalizeSequenceRows(tableById[id], data.tables[id], false);
      });
      next.cellImages = data.cellImages && typeof data.cellImages === 'object' ? data.cellImages : {};
      next.attachments = Array.isArray(data.attachments) ? data.attachments : [];
      state = next;
      render();
    } catch (error) {
      window.alert(`导入失败：${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  function xmlEscape(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function xmlText(value) {
    return String(value == null ? '' : value).split(/\r?\n/).map(xmlEscape).join('</w:t><w:br/><w:t xml:space="preserve">');
  }

  function replaceAll(source, token, value) {
    return source.split(token).join(value);
  }

  function fillRepeatableTables(xml) {
    let generatedRowIndex = 0;
    schema.tables.filter((table) => table.mode === 'repeatable').forEach((table) => {
      const tokenRows = table.rowTokens || [table.tokens];
      const templateRows = [];
      for (const tokenRow of tokenRows) {
        const markerToken = tokenRow.find(Boolean);
        if (!markerToken) continue;
        const markerIndex = xml.indexOf(markerToken);
        if (markerIndex < 0) continue;
        const rowMatches = Array.from(xml.slice(0, markerIndex).matchAll(/<w:tr(?:\s[^>]*)?>/g));
        const rowStart = rowMatches.length ? rowMatches[rowMatches.length - 1].index : -1;
        const rowEndTag = xml.indexOf('</w:tr>', markerIndex);
        if (rowStart < 0 || rowEndTag < 0) throw new Error(`无法定位“${table.title}”的模板行`);
        const rowEnd = rowEndTag + '</w:tr>'.length;
        templateRows.push({ start: rowStart, end: rowEnd, xml: xml.slice(rowStart, rowEnd), tokens: tokenRow });
      }
      if (!templateRows.length) return;
      const rows = state.tables[table.id] && state.tables[table.id].length ? state.tables[table.id] : [table.headers.map(() => '')];
      const renderedRows = rows.map((values, rowIndex) => {
        const sourceIndex = Math.min(rowIndex, templateRows.length - 1);
        const source = templateRows[sourceIndex];
        let row = source.xml;
        source.tokens.forEach((token, ci) => {
          if (!token) return;
          const image = state.cellImages?.[cellImageKey(table.id, rowIndex, ci)];
          const replacement = image ? `__SOR_CELL_IMAGE_${table.id}_${rowIndex}_${ci}__` : xmlText(values[ci] == null ? '' : values[ci]);
          row = replaceAll(row, token, replacement);
        });
        if (rowIndex >= templateRows.length) {
          generatedRowIndex += 1;
          row = row.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
          row = row.replace(/\s+w:rsid\w*="[^"]*"/g, '');
          row = row.replace(/<w:bookmark(?:Start|End)\b[^>]*\/>/g, '');
          let drawingIndex = 0;
          row = row.replace(/(<wp:docPr\b[^>]*\bid=")[^"]*(")/g, (match, start, end) => {
            drawingIndex += 1;
            return `${start}${9000 + generatedRowIndex * 10 + drawingIndex}${end}`;
          });
        }
        return row;
      }).join('');
      xml = xml.slice(0, templateRows[0].start) + renderedRows + xml.slice(templateRows[templateRows.length - 1].end);
    });
    return xml;
  }

  function syncedTableValue(target) {
    if (!target) return '';
    return state.tables[target.tableId]?.[target.row]?.[target.col] || '';
  }

  function dataUrlParts(dataUrl) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl || '');
    return match ? { mime: match[1] || 'application/octet-stream', base64: match[2] } : null;
  }

  function base64Bytes(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function cellImageDrawing(rid, image, drawingId) {
    const sourceWidth = Number(image.width) || 800;
    const sourceHeight = Number(image.height) || 450;
    const maxWidth = 3600000;
    const maxHeight = 2160000;
    const naturalWidth = sourceWidth * 9525;
    const naturalHeight = sourceHeight * 9525;
    const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const name = xmlEscape(image.name || `SOR 图片 ${drawingId}`);
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${drawingId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }

  async function addCellImages(zip, documentXml) {
    const entries = Object.entries(state.cellImages || {}).filter(([, image]) => image?.dataUrl);
    if (!entries.length) return documentXml;
    const rootDeclaration = documentXml.slice(0, documentXml.indexOf('<w:body>'));
    if (!/xmlns:a="/.test(rootDeclaration)) {
      documentXml = documentXml.replace('<w:document ', '<w:document xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ');
    }
    if (!/xmlns:pic="/.test(rootDeclaration)) {
      documentXml = documentXml.replace('<w:document ', '<w:document xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ');
    }
    let rels = await zip.file('word/_rels/document.xml.rels').async('string');
    let types = await zip.file('[Content_Types].xml').async('string');
    let drawingId = 12000;
    for (let index = 0; index < entries.length; index += 1) {
      const [key, image] = entries[index];
      const [tableId, row, col] = key.split(':');
      const marker = `__SOR_CELL_IMAGE_${tableId}_${row}_${col}__`;
      const markerIndex = documentXml.indexOf(marker);
      if (markerIndex < 0) continue;
      const parts = dataUrlParts(image.dataUrl);
      if (!parts || !['image/png', 'image/jpeg'].includes(parts.mime)) continue;
      const extension = parts.mime === 'image/png' ? 'png' : 'jpeg';
      const mediaName = `sor-cell-image-${index + 1}.${extension}`;
      const rid = `rIdSORCellImage${index + 1}`;
      zip.file(`word/media/${mediaName}`, base64Bytes(parts.base64));
      rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`);
      if (!new RegExp(`<Default[^>]+Extension="${extension}"`, 'i').test(types)) {
        types = types.replace('</Types>', `<Default Extension="${extension}" ContentType="${parts.mime}"/></Types>`);
      }
      const runStarts = Array.from(documentXml.slice(0, markerIndex).matchAll(/<w:r(?:\s[^>]*)?>/g));
      const runStart = runStarts.length ? runStarts[runStarts.length - 1].index : -1;
      const runEndTag = documentXml.indexOf('</w:r>', markerIndex);
      if (runStart < 0 || runEndTag < 0) throw new Error(`无法在文档中定位图片“${image.name}”`);
      drawingId += 1;
      documentXml = documentXml.slice(0, runStart) + cellImageDrawing(rid, image, drawingId) + documentXml.slice(runEndTag + 6);
    }
    zip.file('word/_rels/document.xml.rels', rels);
    zip.file('[Content_Types].xml', types);
    return documentXml;
  }

  function attachmentHtml() {
    if (!state.attachments.length) return '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:18mm}body{font-family:'Microsoft YaHei',Arial,sans-serif;font-size:10.5pt;color:#111}h1{font-size:18pt;border-bottom:2px solid #222;padding-bottom:8px}h2{font-size:13pt;margin-top:20px}.item{page-break-inside:avoid;border-top:1px solid #aaa;padding-top:8px;margin-top:12px}.meta{color:#555;font-size:9pt}img{display:block;max-width:165mm;max-height:210mm;margin:10px auto;object-fit:contain}</style></head><body><h1>附件 / Attachments</h1>${state.attachments.map((file, index) => `<div class="item"><h2>${index + 1}. ${esc(file.category)} - ${esc(file.name)}</h2><p>${esc(file.note || '无附件说明')}</p><p class="meta">${esc(file.type)} · ${formatBytes(file.size)}</p>${file.dataUrl.startsWith('data:image/') ? `<img src="${file.dataUrl}" alt="${esc(file.name)}">` : '<p>该文件随 JSON 工程保存；PDF 中仅列出附件索引。</p>'}</div>`).join('')}</body></html>`;
  }

  async function addAttachmentPart(zip, documentXml) {
    if (!state.attachments.length) return documentXml;
    zip.file('word/sor-attachments.html', attachmentHtml());
    let rels = await zip.file('word/_rels/document.xml.rels').async('string');
    const rid = 'rIdSORAttachments';
    rels = rels.replace('</Relationships>', `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="sor-attachments.html"/></Relationships>`);
    zip.file('word/_rels/document.xml.rels', rels);
    let types = await zip.file('[Content_Types].xml').async('string');
    if (!types.includes('sor-attachments.html')) types = types.replace('</Types>', '<Override PartName="/word/sor-attachments.html" ContentType="text/html"/></Types>');
    zip.file('[Content_Types].xml', types);
    return documentXml.replace(/<w:sectPr\b/, `<w:altChunk r:id="${rid}"/><w:sectPr`);
  }

  async function buildDocx() {
    const zip = await JSZip.loadAsync(TEMPLATE.base64, { base64: true });
    let documentXml = await zip.file('word/document.xml').async('string');
    documentXml = fillRepeatableTables(documentXml);
    schema.fields.forEach((field) => { documentXml = replaceAll(documentXml, field.token, xmlText(state.fields[field.id])); });
    documentXml = documentXml.replace(/<w:highlight\b[^>]*\/>/g, '');
    documentXml = await addCellImages(zip, documentXml);
    documentXml = await addAttachmentPart(zip, documentXml);
    zip.file('word/document.xml', documentXml);

    const sorNo = syncedTableValue(schema.sync.sorNo);
    const version = syncedTableValue(schema.sync.version);
    for (const headerPart of schema.sync.headerParts || []) {
      if (!zip.file(headerPart)) continue;
      let header = await zip.file(headerPart).async('string');
      header = replaceAll(header, schema.sync.headerToken, xmlText(`${sorNo}${version ? `—${version}` : ''}`));
      header = header.replace(/<w:highlight\b[^>]*\/>/g, '');
      zip.file(headerPart, header);
    }
    if (zip.file('word/settings.xml')) {
      let settings = await zip.file('word/settings.xml').async('string');
      if (/<w:updateFields\b/.test(settings)) settings = settings.replace(/<w:updateFields\b[^>]*\/?>(?:<\/w:updateFields>)?/, '<w:updateFields w:val="true"/>');
      else settings = settings.replace('</w:settings>', '<w:updateFields w:val="true"/></w:settings>');
      zip.file('word/settings.xml', settings);
    }
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  }

  async function withBusy(button, work) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = '正在生成…';
    try { await work(); } catch (error) { console.error(error); window.alert(`生成失败：${error.message}`); } finally { button.disabled = false; button.textContent = original; }
  }

  function exportWord(event) {
    withBusy(event.currentTarget, async () => {
      const blob = await buildDocx();
      downloadBlob(blob, normalizeFileName(state.meta.fileName, '.docx'));
      window.alert('Word 已生成。首次打开时请在 Word 中选择“更新整个目录”，以刷新页码和目录。');
    });
  }

  function closePreview() {
    hostRef.querySelector('#sorPreviewShell').classList.remove('active');
    previewHost.innerHTML = '';
  }

  function exportPdf(event) {
    withBusy(event.currentTarget, async () => {
      if (!window.docx || typeof window.docx.renderAsync !== 'function') throw new Error('Word 预览组件未加载');
      const blob = await buildDocx();
      const shell = hostRef.querySelector('#sorPreviewShell');
      shell.classList.add('active');
      await window.docx.renderAsync(blob, previewHost, null, {
        inWrapper: true,
        hideWrapperOnPrint: false,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: false,
        renderHeaders: true,
        renderFooters: true,
        renderAltChunks: true,
      });
      shell.setAttribute('aria-hidden', 'false');
      const originalParent = shell.parentNode;
      const originalNextSibling = shell.nextSibling;
      document.body.appendChild(shell);
      const restoreShell = () => {
        originalParent.insertBefore(shell, originalNextSibling);
        window.removeEventListener('afterprint', restoreShell);
      };
      window.addEventListener('afterprint', restoreShell);
      setTimeout(() => window.print(), 300);
    });
  }

  function moduleStyle() {
    return `
      .sor-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(135deg,#f7fafc,#eef4f8);border-left:4px solid #173b5e}.sor-kicker{margin:0;color:#a36600;font-size:11px;letter-spacing:.12em}.sor-hero h3{font-size:24px;margin:4px 0}.sor-hero p{margin:4px 0}.sor-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.sor-file-btn{position:relative;overflow:hidden}.sor-file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}.sor-meta{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:12px;align-items:end}.sor-meta label,.sor-attachment-category label{display:grid;gap:5px}.sor-meta label span,.sor-attachment-category label{font-size:12px;font-weight:700}.sor-template-fact{border:1px solid #c7d2dc;padding:10px 12px;background:#fff;display:grid;gap:2px}.sor-template-fact span,.sor-template-fact small{color:#607181}.sor-guide ul{columns:2;margin-bottom:0}.sor-guide li{break-inside:avoid;margin-bottom:7px}.sor-attachment-head,.sor-table-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.sor-attachment-head h3,.sor-table-heading p{margin:0}.sor-table-heading>div{display:grid;gap:4px}.sor-paste-hint{font-size:11px;color:#3e627f}.sor-chapter-badge{display:inline-block;width:max-content;margin:0 7px 2px 0;padding:2px 7px;border-radius:999px;background:#e6eef5;color:#173b5e;font-size:11px;font-style:normal;font-weight:700}.sor-attachment-category{display:grid;grid-template-columns:220px 1fr;gap:12px;margin:12px 0}.sor-attachment-item{display:grid;grid-template-columns:58px 1fr 32px;gap:10px;align-items:center;border-top:1px solid #d8e0e7;padding:8px 0}.sor-attachment-item img{width:56px;height:44px;object-fit:cover}.sor-attachment-item span>b{display:flex;width:56px;height:44px;align-items:center;justify-content:center;background:#e6edf3;font-size:11px}.sor-attachment-item div{display:grid}.sor-attachment-item small{color:#607181}.sor-attachment-item button,.sor-delete-row{border:1px solid #efb6b6;color:#b42318;background:#fff5f5;border-radius:6px;font-size:20px;cursor:pointer}.sor-sections{display:grid;gap:10px}.sor-section{border:1px solid #bdcad5;background:#fff}.sor-section summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;cursor:pointer;background:#f2f6f9}.sor-section summary span{display:grid;gap:3px}.sor-section summary small{font-weight:400;color:#607181}.sor-section summary em{font-style:normal;background:#173b5e;color:#fff;padding:3px 8px;border-radius:999px;font-size:11px}.sor-section-body{padding:14px 16px}.sor-section-tools{text-align:right;margin-bottom:8px}.sor-field{display:grid;grid-template-columns:minmax(160px,22%) 1fr;gap:5px 14px;padding:10px 0;border-top:1px solid #e0e6eb}.sor-field>span{display:block;font-weight:700;line-height:1.45}.sor-field>small{grid-column:2;color:#647587}.sor-field textarea{resize:vertical;min-height:70px}.sor-table-block{border-top:2px solid #8fa2b4;margin-top:14px;padding-top:12px}.sor-table-heading p{font-size:12px;color:#607181;margin-top:0}.sor-table-scroll{overflow:auto;margin-top:8px}.sor-editor-table{width:100%;border-collapse:collapse;min-width:760px;table-layout:fixed}.sor-editor-table col.sor-col-index{width:78px}.sor-editor-table col.sor-col-action{width:54px}.sor-editor-table th,.sor-editor-table td{border:1px solid #bfcbd6;padding:5px;vertical-align:top;background:#fff}.sor-editor-table th{background:#edf2f6}.sor-editor-table th.sor-col-index,.sor-editor-table td.sor-col-index{text-align:center}.sor-editor-table td.sor-col-index textarea{text-align:center}.sor-editor-table textarea{width:100%;min-height:48px;border:0;padding:5px;resize:vertical;background:#fff}.sor-action-col,.sor-repeatable-table .sor-editor-table td:last-child{width:54px;text-align:center}.sor-image-cell{display:grid;gap:7px}.sor-image-control{display:flex;align-items:center;gap:7px;padding-top:6px;border-top:1px dashed #c7d2dc}.sor-image-control img{width:88px;height:62px;object-fit:contain;background:#f3f6f8;border:1px solid #ccd6df}.sor-image-control span{min-width:0;overflow:hidden;text-overflow:ellipsis}.sor-image-control button{border:0;background:none;color:#b42318;cursor:pointer;white-space:nowrap}.sor-image-control small{color:#647587}.sor-preview-shell{display:none;position:fixed;z-index:1000;inset:0;background:#68737d;overflow:auto;padding:52px 20px 20px}.sor-preview-shell.active{display:block}.sor-preview-toolbar{position:fixed;z-index:1001;top:0;left:0;right:0;height:44px;background:#132b43;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 18px}.sor-preview-toolbar button{background:#fff;border:0;padding:6px 12px;cursor:pointer}.sor-docx-preview{max-width:210mm;margin:auto}.sor-docx-preview .docx-wrapper{background:#68737d;padding:10px}.sor-docx-preview section.docx{box-shadow:0 2px 10px #27323b;margin:0 auto 12px!important}.btn.danger{color:#b42318;border-color:#e2a7a7}
      @media(max-width:900px){.sor-hero{align-items:flex-start;flex-direction:column}.sor-actions{justify-content:flex-start}.sor-meta{grid-template-columns:1fr}.sor-guide ul{columns:1}.sor-field{grid-template-columns:1fr}.sor-field>small{grid-column:1}.sor-attachment-category{grid-template-columns:1fr}}
      @media print{@page{size:A4 portrait;margin:0}html,body{width:210mm!important;min-height:0!important;height:auto!important;background:#fff!important}body>*:not(.sor-preview-shell){display:none!important}.sor-preview-shell.active{display:block!important;position:static!important;inset:auto!important;width:210mm!important;background:#fff!important;padding:0!important;overflow:visible!important}.sor-preview-toolbar{display:none!important}.sor-docx-preview{display:block!important;max-width:none!important}.sor-docx-preview .docx-wrapper{display:block!important;background:#fff!important;padding:0!important}.sor-docx-preview section.docx{display:flex!important;flex-flow:column nowrap!important;box-sizing:border-box!important;box-shadow:none!important;margin:0!important;break-after:page!important;page-break-after:always!important;width:210mm!important;height:297mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important}.sor-docx-preview section.docx:last-child{break-after:auto!important;page-break-after:auto!important}}
    `;
  }

  ElectricalToolkit.register({
    id: 'sor-generator',
    title: 'SOR 文件生成器',
    group: '工程文档',
    desc: '按公开版 SOR 模板逐章、逐表填写，生成 A4 Word/PDF，并支持 JSON 续填与附件。',
    render(host) {
      hostRef = host;
      state = defaultState();
      render();
    },
  });
})();
