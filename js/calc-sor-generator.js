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
    schema.tables.forEach((table) => { tables[table.id] = clone(table.defaults); });
    return {
      formatVersion: 2,
      templateSha256: schema.sourceSha256,
      meta: {
        fileName: '项目_SOR',
        documentHeader: '按封面SOR编号与版本自动生成',
      },
      fields,
      tables,
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
      const hasValue = rows.some((row, ri) => row.some((cell, ci) => {
        if (table.mode === 'fixed' && !table.grid?.[ri]?.[ci]?.editable) return false;
        return String(cell || '').trim();
      }));
      if (hasValue) complete += 1;
    });
    return { total, complete };
  }

  function tableEditor(table) {
    const rows = state.tables[table.id] || [];
    if (table.mode === 'fixed') {
      return `<div class="sor-table-block sor-fixed-table" data-sor-table="${esc(table.id)}">
        <div class="sor-table-heading"><div><strong>${esc(table.title)}</strong><p>${esc(table.hint)}</p></div></div>
        <div class="sor-table-scroll"><table class="sor-editor-table"><tbody>${table.grid.map((gridRow, ri) => `<tr>${gridRow.map((cell, ci) => cell.editable
          ? `<td class="sor-editable-cell"><textarea rows="2" data-table-id="${esc(table.id)}" data-row="${ri}" data-col="${ci}" aria-label="${esc(cell.text || `${table.title} 第${ri + 1}行第${ci + 1}列`)}">${esc(rows[ri]?.[ci] || '')}</textarea></td>`
          : `<th scope="row">${esc(cell.text)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>
      </div>`;
    }
    return `<div class="sor-table-block sor-repeatable-table" data-sor-table="${esc(table.id)}">
      <div class="sor-table-heading">
        <div><strong>${esc(table.title)}</strong><p>${esc(table.hint)}</p></div>
        <button type="button" class="btn sor-add-row" data-table-id="${esc(table.id)}">添加一行</button>
      </div>
      <div class="sor-table-scroll"><table class="sor-editor-table"><thead><tr>${table.headers.map((header) => `<th>${esc(header)}</th>`).join('')}<th class="sor-action-col">操作</th></tr></thead>
      <tbody>${rows.map((row, ri) => `<tr>${table.headers.map((header, ci) => `<td><textarea rows="2" data-table-id="${esc(table.id)}" data-row="${ri}" data-col="${ci}" aria-label="${esc(header)}">${esc(row[ci] || '')}</textarea></td>`).join('')}<td><button type="button" class="sor-delete-row" data-table-id="${esc(table.id)}" data-row="${ri}" title="删除本行">×</button></td></tr>`).join('')}</tbody></table></div>
    </div>`;
  }

  function render() {
    const activeOpen = hostRef.querySelector('details[open]')?.dataset.sectionId;
    const sectionsHtml = uiSections.map((section, index) => {
      const progress = sectionProgress(section);
      const fields = section.fieldIds.map((id) => fieldById[id]).filter(Boolean);
      const tables = section.tableIds.map((id) => tableById[id]).filter(Boolean);
      if (!fields.length && !tables.length) return '';
      return `<details class="sor-section" data-section-id="${esc(section.id)}" ${index === 0 || activeOpen === section.id ? 'open' : ''}>
        <summary><span><b>${esc(section.title)}</b><small>${esc(section.description)}</small></span><em>${progress.complete}/${progress.total}</em></summary>
        <div class="sor-section-body">
          <div class="sor-section-tools"><button type="button" class="btn sor-fill-section" data-section-id="${esc(section.id)}">本章一键填充模板默认信息</button></div>
          ${fields.map((field) => `<label class="sor-field"><span>${esc(field.label)}</span>${fieldControl(field)}<small>${esc(field.hint)}</small></label>`).join('')}
          ${tables.map(tableEditor).join('')}
        </div>
      </details>`;
    }).join('');

    hostRef.innerHTML = `<style>${moduleStyle()}</style>
      <section class="panel sor-hero">
        <div><p class="sor-kicker">公开版 SOR Template · A4 原版生成</p><h3>SOR 项目文件生成器</h3><p>新版填写区按原模板表格组织：固定信息直接填写，可扩展清单可自由增减行；目录无需输入。</p></div>
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
    hostRef.querySelector('#sorFileName').addEventListener('input', (event) => { state.meta.fileName = event.target.value; });
    hostRef.querySelectorAll('.sor-add-row').forEach((button) => button.addEventListener('click', () => {
      const table = tableById[button.dataset.tableId];
      state.tables[table.id].push(table.headers.map(() => ''));
      render();
    }));
    hostRef.querySelectorAll('.sor-delete-row').forEach((button) => button.addEventListener('click', () => {
      const rows = state.tables[button.dataset.tableId];
      rows.splice(Number(button.dataset.row), 1);
      if (!rows.length) rows.push(tableById[button.dataset.tableId].headers.map(() => ''));
      render();
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

  function fillSection(sectionId) {
    const section = uiSections.find((item) => item.id === sectionId);
    if (!section) return;
    section.fieldIds.forEach((id) => { state.fields[id] = fieldById[id].default; });
    section.tableIds.forEach((id) => { state.tables[id] = clone(tableById[id].defaults); });
    render();
  }

  function clearAll() {
    if (!window.confirm('确认清空当前 SOR 校核内容、表格行和全部附件吗？此操作无法撤销；建议先导出 JSON 备份。')) return;
    state = defaultState();
    Object.keys(state.fields).forEach((id) => { state.fields[id] = ''; });
    Object.keys(state.tables).forEach((id) => {
      const table = tableById[id];
      state.tables[id] = table.mode === 'fixed'
        ? table.defaults.map((row) => row.map(() => ''))
        : [table.headers.map(() => '')];
    });
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
      Object.keys(next.tables).forEach((id) => { if (Array.isArray(data.tables[id])) next.tables[id] = data.tables[id]; });
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
          if (token) row = replaceAll(row, token, xmlText(values[ci] == null ? '' : values[ci]));
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

  function fillFixedTables(xml) {
    schema.tables.filter((table) => table.mode === 'fixed').forEach((table) => {
      const values = state.tables[table.id] || [];
      table.tokensGrid.forEach((tokenRow, ri) => tokenRow.forEach((token, ci) => {
        if (token) xml = replaceAll(xml, token, xmlText(values[ri]?.[ci] == null ? '' : values[ri][ci]));
      }));
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
    documentXml = fillFixedTables(documentXml);
    schema.fields.forEach((field) => { documentXml = replaceAll(documentXml, field.token, xmlText(state.fields[field.id])); });
    documentXml = documentXml.replace(/<w:highlight\b[^>]*\/>/g, '');
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
      setTimeout(() => window.print(), 300);
    });
  }

  function moduleStyle() {
    return `
      .sor-hero{display:flex;justify-content:space-between;gap:20px;align-items:center;background:linear-gradient(135deg,#f7fafc,#eef4f8);border-left:4px solid #173b5e}.sor-kicker{margin:0;color:#a36600;font-size:11px;letter-spacing:.12em}.sor-hero h3{font-size:24px;margin:4px 0}.sor-hero p{margin:4px 0}.sor-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.sor-file-btn{position:relative;overflow:hidden}.sor-file-btn input{position:absolute;inset:0;opacity:0;cursor:pointer}.sor-meta{display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:12px;align-items:end}.sor-meta label,.sor-attachment-category label{display:grid;gap:5px}.sor-meta label span,.sor-attachment-category label{font-size:12px;font-weight:700}.sor-template-fact{border:1px solid #c7d2dc;padding:10px 12px;background:#fff;display:grid;gap:2px}.sor-template-fact span,.sor-template-fact small{color:#607181}.sor-guide ul{columns:2;margin-bottom:0}.sor-guide li{break-inside:avoid;margin-bottom:7px}.sor-attachment-head,.sor-table-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.sor-attachment-head h3,.sor-table-heading p{margin:0}.sor-attachment-category{display:grid;grid-template-columns:220px 1fr;gap:12px;margin:12px 0}.sor-attachment-item{display:grid;grid-template-columns:58px 1fr 32px;gap:10px;align-items:center;border-top:1px solid #d8e0e7;padding:8px 0}.sor-attachment-item img{width:56px;height:44px;object-fit:cover}.sor-attachment-item span>b{display:flex;width:56px;height:44px;align-items:center;justify-content:center;background:#e6edf3;font-size:11px}.sor-attachment-item div{display:grid}.sor-attachment-item small{color:#607181}.sor-attachment-item button,.sor-delete-row{border:1px solid #efb6b6;color:#b42318;background:#fff5f5;border-radius:6px;font-size:20px;cursor:pointer}.sor-sections{display:grid;gap:10px}.sor-section{border:1px solid #bdcad5;background:#fff}.sor-section summary{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 16px;cursor:pointer;background:#f2f6f9}.sor-section summary span{display:grid;gap:3px}.sor-section summary small{font-weight:400;color:#607181}.sor-section summary em{font-style:normal;background:#173b5e;color:#fff;padding:3px 8px;border-radius:999px;font-size:11px}.sor-section-body{padding:14px 16px}.sor-section-tools{text-align:right;margin-bottom:8px}.sor-field{display:grid;grid-template-columns:minmax(160px,22%) 1fr;gap:5px 14px;padding:10px 0;border-top:1px solid #e0e6eb}.sor-field>span{font-weight:700;line-height:1.45}.sor-field>small{grid-column:2;color:#647587}.sor-field textarea{resize:vertical;min-height:70px}.sor-table-block{border-top:2px solid #8fa2b4;margin-top:14px;padding-top:12px}.sor-table-heading p{font-size:12px;color:#607181;margin-top:4px}.sor-table-scroll{overflow:auto;margin-top:8px}.sor-editor-table{width:100%;border-collapse:collapse;min-width:760px;table-layout:fixed}.sor-editor-table th,.sor-editor-table td{border:1px solid #bfcbd6;padding:5px;vertical-align:top}.sor-editor-table th{background:#edf2f6}.sor-fixed-table .sor-editor-table th{width:28%;text-align:left;font-weight:600}.sor-fixed-table .sor-editor-table{min-width:620px}.sor-editable-cell{background:#fffbed}.sor-editor-table textarea{width:100%;min-height:48px;border:0;padding:5px;resize:vertical;background:#fff}.sor-editable-cell textarea{background:#fffef6}.sor-action-col,.sor-repeatable-table .sor-editor-table td:last-child{width:45px;text-align:center}.sor-preview-shell{display:none;position:fixed;z-index:1000;inset:0;background:#68737d;overflow:auto;padding:52px 20px 20px}.sor-preview-shell.active{display:block}.sor-preview-toolbar{position:fixed;z-index:1001;top:0;left:0;right:0;height:44px;background:#132b43;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 18px}.sor-preview-toolbar button{background:#fff;border:0;padding:6px 12px;cursor:pointer}.sor-docx-preview{max-width:210mm;margin:auto}.sor-docx-preview .docx-wrapper{background:#68737d;padding:10px}.sor-docx-preview section.docx{box-shadow:0 2px 10px #27323b;margin:0 auto 12px!important}.btn.danger{color:#b42318;border-color:#e2a7a7}
      @media(max-width:900px){.sor-hero{align-items:flex-start;flex-direction:column}.sor-actions{justify-content:flex-start}.sor-meta{grid-template-columns:1fr}.sor-guide ul{columns:1}.sor-field{grid-template-columns:1fr}.sor-field>small{grid-column:1}.sor-attachment-category{grid-template-columns:1fr}}
      @media print{@page{size:A4 portrait;margin:0}body>*{display:none!important}.sor-preview-shell.active{display:block!important;position:static!important;inset:auto!important;background:#fff!important;padding:0!important;overflow:visible!important}.sor-preview-toolbar{display:none!important}.sor-docx-preview{display:block!important;max-width:none!important}.sor-docx-preview .docx-wrapper{display:block!important;background:#fff!important;padding:0!important}.sor-docx-preview section.docx{display:block!important;box-shadow:none!important;margin:0!important;page-break-after:always!important;width:210mm!important;min-height:297mm!important}}
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
