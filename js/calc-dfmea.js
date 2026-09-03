/** 基于原版 Excel 模板的三级动力电池电气 DFMEA 生成器。 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const LIB = window.DFMEA_LIBRARY;
  const FIELDS = LIB.fields;
  const LABELS = {
    C:'1.上一较高级别', D:'2.关注要素', E:'3.下一较低级别/特性',
    F:'1.上一较高级别功能及要求', G:'2.关注要素功能及要求', H:'3.下一较低级别功能及要求/特性',
    I:'对上层/最终用户的失效影响（FE）', J:'严重度 S', K:'关注要素失效模式（FM）', L:'下层失效原因（FC）',
    M:'现行预防措施（PC）', N:'发生度 O', O:'现行探测措施（DC）', P:'探测度 D', Q:'AP',
  };
  const GROUP = { C:'structure',D:'structure',E:'structure',F:'function',G:'function',H:'function',I:'failure',J:'failure',K:'failure',L:'failure',M:'risk',N:'risk',O:'risk',P:'risk',Q:'risk' };
  let hostRef;
  let state = { query:'', level:'全部', family:'全部', selected:[], rows:[] };

  function esc(v) { return E.escapeHtml(v == null ? '' : String(v)); }
  function cloneRow(item) { const out={ id:`USR-${Date.now()}-${Math.random().toString(16).slice(2)}`, sourceId:item.id||'', level:item.level||'', tags:item.tags||[] }; FIELDS.forEach((f)=>{ out[f]=item[f] == null ? '' : item[f]; }); return out; }
  function ap(s, o, d) {
    s=+s||0; o=+o||0; d=+d||0;
    if (s >= 9) return (o >= 2 || d >= 7) ? 'H' : 'M';
    if (s >= 7) return (o >= 4 || (o >= 2 && d >= 7)) ? 'H' : (o >= 2 || d >= 5 ? 'M' : 'L');
    if (s >= 4) return (o >= 7 && d >= 7) ? 'H' : (o >= 4 || d >= 7 ? 'M' : 'L');
    return (o >= 7 && d >= 7) ? 'M' : 'L';
  }
  function families() { return [...new Set(LIB.rows.flatMap((r)=>r.tags||[]))].sort((a,b)=>a.localeCompare(b,'zh-CN')); }
  function filtered() {
    const q=state.query.trim().toLowerCase();
    return LIB.rows.filter((r)=>(state.level==='全部'||String(r.level)===state.level)
      && (state.family==='全部'||(r.tags||[]).includes(state.family))
      && (!q||[r.id,...FIELDS.map((f)=>r[f]),...(r.tags||[])].join(' ').toLowerCase().includes(q)));
  }
  function levelName(level) { return level===1?'第一层级 · 电气系统':level===2?'第二层级 · 部件':'第三层级 · 子零件'; }
  function options(value) { return Array.from({length:10},(_,i)=>`<option value="${i+1}"${+value===i+1?' selected':''}>${i+1}</option>`).join(''); }
  function download(blob, name) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1200); }

  function render(host) {
    hostRef=host;
    host.innerHTML=`<style>${styles()}</style>
      <section class="panel df-intro"><div><span class="df-kicker">AIAG/VDA WORKSHEET · OFFLINE</span><h3>动力电池电气系统三级 DFMEA</h3><p>网页仅编辑模板第15行起的 <b>C–P列</b>；保留附件二37条系统需求，并补充缺失的系统父功能。第二层严格继承系统父行，第三层严格继承部件父行。导出保留原Excel标题、色带、列宽和A4打印设置。</p></div><div class="df-counts"><b>${LIB.rows.filter(r=>r.level===1).length}</b><span>系统需求</span><b>${LIB.rows.filter(r=>r.level===2).length}</b><span>部件分析</span><b>${LIB.rows.filter(r=>r.level===3).length}</b><span>子零件分析</span></div></section>
      <section class="panel df-library"><div class="df-section-head"><div><h3>DFMEA底库</h3><p>筛选、勾选需要的条目，再加入当前DFMEA；加入后可逐格修改，不会反向改变底库。</p></div><button type="button" class="btn btn-primary" id="dfAddSelected">加入已选条目</button></div>
        <div class="df-filters"><label>搜索<input id="dfQuery" value="${esc(state.query)}" placeholder="功能、部件、失效模式、措施…"></label><label>层级<select id="dfLevel"><option>全部</option><option value="1"${state.level==='1'?' selected':''}>第一层级</option><option value="2"${state.level==='2'?' selected':''}>第二层级</option><option value="3"${state.level==='3'?' selected':''}>第三层级</option></select></label><label>对象<select id="dfFamily"><option>全部</option>${families().map(x=>`<option${state.family===x?' selected':''}>${esc(x)}</option>`).join('')}</select></label><button type="button" class="btn btn-ghost" id="dfSelectVisible">全选当前结果</button></div>
        <div class="df-result-meta"><span id="dfResultCount"></span><span>第一层含附件二${LIB.originalSystemCount}条原始需求及补充父功能；系统级 C/F/I 保持空白。</span></div><div class="df-library-list" id="dfLibraryList"></div>
      </section>
      <section class="panel df-work"><div class="df-section-head"><div><h3>当前DFMEA</h3><p>可横向滚动。支持从Excel复制多格后，在任意单元格直接粘贴；制表符与换行会依次填入右侧和下方单元格。</p></div><div class="df-toolbar"><button type="button" class="btn btn-ghost" data-add-level="1">加入全部系统需求</button><button type="button" class="btn btn-ghost" data-add-level="2">加入全部部件</button><button type="button" class="btn btn-ghost" data-add-level="3">加入全部子零件</button><button type="button" class="btn btn-ghost" id="dfAddBlank">添加空白行</button></div></div>
        <div class="df-actionbar"><span id="dfWorkCount"></span><div><button type="button" class="btn btn-ghost" id="dfImportJson">导入JSON</button><button type="button" class="btn btn-ghost" id="dfExportJson">导出JSON</button><button type="button" class="btn btn-primary" id="dfExportXlsx">按原模板导出DFMEA</button><button type="button" class="btn btn-danger" id="dfClear">清空</button><input id="dfJsonFile" type="file" accept="application/json,.json" hidden></div></div>
        <div class="df-table-wrap"><table class="df-table"><thead><tr>${FIELDS.map(f=>`<th class="${GROUP[f]}"><small>${f}列</small>${esc(LABELS[f])}</th>`).join('')}<th class="risk"><small>Q列 · 自动</small>AP</th><th class="operation">操作</th></tr></thead><tbody id="dfWorkBody"></tbody></table></div>
        <p class="df-ap-note">AP依据S/O/D做保守工程预判（H/M/L），用于快速筛查；正式签署前请按项目指定版本的AIAG/VDA或公司AP表复核。</p>
      </section>`;
    bind(); renderLibrary(); renderWork();
  }

  function renderLibrary() {
    const rows=filtered();
    hostRef.querySelector('#dfResultCount').textContent=`显示 ${rows.length} / ${LIB.rows.length} 条`;
    hostRef.querySelector('#dfLibraryList').innerHTML=rows.map(r=>`<label class="df-lib-row"><input type="checkbox" data-lib-select="${esc(r.id)}"${state.selected.includes(r.id)?' checked':''}><span class="df-level l${r.level}">${levelName(r.level)}</span><span><b>${esc(r.D)}</b><small>${esc(r.G)}</small></span><span><b>${esc(r.K)}</b><small>${esc(r.I||r.L)}</small></span><button type="button" class="btn btn-ghost btn-sm" data-add-one="${esc(r.id)}">加入</button></label>`).join('')||'<div class="empty-tip">没有匹配条目。</div>';
  }
  function inputCell(r, field, index) {
    if (field==='J'||field==='N'||field==='P') return `<td class="score"><select data-row="${index}" data-field="${field}" aria-label="${esc(LABELS[field])}">${options(r[field])}</select></td>`;
    return `<td><textarea rows="3" data-row="${index}" data-field="${field}" aria-label="${esc(LABELS[field])}">${esc(r[field])}</textarea></td>`;
  }
  function renderWork() {
    hostRef.querySelector('#dfWorkCount').textContent=`共 ${state.rows.length} 行 · H ${state.rows.filter(r=>ap(r.J,r.N,r.P)==='H').length} / M ${state.rows.filter(r=>ap(r.J,r.N,r.P)==='M').length} / L ${state.rows.filter(r=>ap(r.J,r.N,r.P)==='L').length}`;
    hostRef.querySelector('#dfWorkBody').innerHTML=state.rows.map((r,i)=>`<tr data-index="${i}">${FIELDS.map(f=>inputCell(r,f,i)).join('')}<td class="ap"><span class="ap-${ap(r.J,r.N,r.P).toLowerCase()}">${ap(r.J,r.N,r.P)}</span></td><td class="operation"><button type="button" class="btn btn-ghost btn-sm" data-duplicate="${i}">复制</button><button type="button" class="btn btn-danger btn-sm" data-delete="${i}">删除</button></td></tr>`).join('')||'<tr><td colspan="16" class="empty-tip">尚未添加分析行。可从上方底库选择，也可添加空白行。</td></tr>';
  }
  function addRows(rows) { const existing=new Set(state.rows.map(r=>r.sourceId).filter(Boolean)); const added=rows.filter(r=>!existing.has(r.id)).map(cloneRow); state.rows.push(...added); renderWork(); }
  function bind() {
    const h=hostRef;
    h.querySelector('#dfQuery').addEventListener('input',e=>{state.query=e.target.value;renderLibrary();});
    h.querySelector('#dfLevel').addEventListener('change',e=>{state.level=e.target.value;renderLibrary();});
    h.querySelector('#dfFamily').addEventListener('change',e=>{state.family=e.target.value;renderLibrary();});
    h.querySelector('#dfSelectVisible').addEventListener('click',()=>{state.selected=filtered().map(r=>r.id);renderLibrary();});
    h.querySelector('#dfAddSelected').addEventListener('click',()=>{addRows(LIB.rows.filter(r=>state.selected.includes(r.id)));state.selected=[];renderLibrary();});
    h.querySelector('#dfAddBlank').addEventListener('click',()=>{state.rows.push(cloneRow({level:'',id:'',J:5,N:3,P:5}));renderWork();});
    h.querySelectorAll('[data-add-level]').forEach(b=>b.addEventListener('click',()=>addRows(LIB.rows.filter(r=>String(r.level)===b.dataset.addLevel))));
    h.querySelector('#dfClear').addEventListener('click',()=>{if(confirm('确定清空当前DFMEA的全部行吗？建议先导出JSON备份。')){state.rows=[];renderWork();}});
    h.querySelector('#dfExportJson').addEventListener('click',()=>download(new Blob([JSON.stringify({type:'electrical-dfmea',version:LIB.version,rows:state.rows},null,2)],{type:'application/json'}),`DFMEA_${dateTag()}.json`));
    h.querySelector('#dfImportJson').addEventListener('click',()=>h.querySelector('#dfJsonFile').click());
    h.querySelector('#dfJsonFile').addEventListener('change',importJson);
    h.querySelector('#dfExportXlsx').addEventListener('click',exportXlsx);
    h.addEventListener('change',event=>{
      const check=event.target.closest('[data-lib-select]'); if(check){state.selected=check.checked?[...new Set([...state.selected,check.dataset.libSelect])]:state.selected.filter(x=>x!==check.dataset.libSelect);return;}
      const cell=event.target.closest('[data-row][data-field]'); if(cell){state.rows[+cell.dataset.row][cell.dataset.field]=cell.value;renderWork();}
    });
    h.addEventListener('input',event=>{const cell=event.target.closest('textarea[data-row][data-field]');if(cell)state.rows[+cell.dataset.row][cell.dataset.field]=cell.value;});
    h.addEventListener('click',event=>{
      const one=event.target.closest('[data-add-one]'); if(one){addRows(LIB.rows.filter(r=>r.id===one.dataset.addOne));return;}
      const dup=event.target.closest('[data-duplicate]'); if(dup){state.rows.splice(+dup.dataset.duplicate+1,0,cloneRow(state.rows[+dup.dataset.duplicate]));renderWork();return;}
      const del=event.target.closest('[data-delete]'); if(del){state.rows.splice(+del.dataset.delete,1);renderWork();}
    });
    h.addEventListener('paste',pasteGrid,true);
  }
  function pasteGrid(event) {
    const target=event.target.closest('[data-row][data-field]'); if(!target)return;
    const text=event.clipboardData&&event.clipboardData.getData('text/plain'); if(!text||(!text.includes('\t')&&!/[\r\n]/.test(text)))return;
    event.preventDefault(); const matrix=text.replace(/\r/g,'').split('\n').filter((x,i,a)=>i<a.length-1||x!=='').map(line=>line.split('\t'));
    const startRow=+target.dataset.row, startCol=FIELDS.indexOf(target.dataset.field);
    matrix.forEach((cells,ri)=>{while(state.rows.length<=startRow+ri)state.rows.push(cloneRow({J:5,N:3,P:5}));cells.forEach((value,ci)=>{const field=FIELDS[startCol+ci];if(field)state.rows[startRow+ri][field]=['J','N','P'].includes(field)?Math.max(1,Math.min(10,+value||1)):value;});});
    renderWork();
  }
  async function importJson(event) {
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try{const data=JSON.parse(await file.text());if(!Array.isArray(data.rows))throw new Error('文件中没有rows数组');state.rows=data.rows.map(cloneRow);renderWork();}catch(error){alert('JSON导入失败：'+error.message);}
  }
  function dateTag(){return new Date().toISOString().slice(0,10).replace(/-/g,'');}
  function b64Bytes(value){const raw=atob(value),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
  function colName(ref){return ref.replace(/\d+/g,'');}
  function setCell(doc,rowEl,col,rowNo,value,numeric=false,styleId='50'){
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';let cell=[...rowEl.getElementsByTagNameNS(ns,'c')].find(c=>colName(c.getAttribute('r'))===col);
    if(!cell){cell=doc.createElementNS(ns,'c');rowEl.appendChild(cell);}cell.setAttribute('s',String(styleId));cell.setAttribute('r',`${col}${rowNo}`);while(cell.firstChild)cell.removeChild(cell.firstChild);
    if(value==null||value===''){cell.removeAttribute('t');return;} if(numeric){cell.removeAttribute('t');const v=doc.createElementNS(ns,'v');v.textContent=String(value);cell.appendChild(v);return;}
    cell.setAttribute('t','inlineStr');const is=doc.createElementNS(ns,'is'),t=doc.createElementNS(ns,'t');t.setAttribute('xml:space','preserve');t.textContent=String(value);is.appendChild(t);cell.appendChild(is);
  }
  async function addWrappedDataStyle(zip){
    const path='xl/styles.xml',xml=await zip.file(path).async('string'),doc=new DOMParser().parseFromString(xml,'application/xml');
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',cellXfs=doc.getElementsByTagNameNS(ns,'cellXfs')[0];
    if(!cellXfs)throw new Error('模板样式表缺少cellXfs');const styles=[...cellXfs.childNodes].filter(n=>n.nodeType===1),source=styles[50]||styles[styles.length-1],xf=source.cloneNode(true);
    let alignment=xf.getElementsByTagNameNS(ns,'alignment')[0];if(!alignment){alignment=doc.createElementNS(ns,'alignment');xf.appendChild(alignment);}alignment.setAttribute('horizontal','left');alignment.setAttribute('vertical','top');alignment.setAttribute('wrapText','1');xf.setAttribute('applyAlignment','1');
    cellXfs.appendChild(xf);cellXfs.setAttribute('count',String(styles.length+1));zip.file(path,new XMLSerializer().serializeToString(doc));return styles.length;
  }
  async function exportXlsx(){
    if(!state.rows.length){alert('请先添加至少一行DFMEA内容。');return;} if(!window.JSZip||!window.DFMEA_TEMPLATE_BASE64){alert('Excel模板组件未加载，请确认工具目录完整。');return;}
    const button=hostRef.querySelector('#dfExportXlsx');button.disabled=true;button.textContent='正在生成…';
    try{
      const zip=await JSZip.loadAsync(b64Bytes(window.DFMEA_TEMPLATE_BASE64));const styleId=await addWrappedDataStyle(zip);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');const doc=new DOMParser().parseFromString(xml,'application/xml');
      if(doc.querySelector('parsererror'))throw new Error('模板工作表解析失败');const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';const sheetData=doc.getElementsByTagNameNS(ns,'sheetData')[0];const template=[...sheetData.getElementsByTagNameNS(ns,'row')].find(r=>r.getAttribute('r')==='15');if(!template)throw new Error('模板缺少第15行样式');
      [...sheetData.getElementsByTagNameNS(ns,'row')].filter(r=>+r.getAttribute('r')>=15).forEach(r=>sheetData.removeChild(r));
      state.rows.forEach((data,index)=>{const no=15+index,rowEl=template.cloneNode(true),maxLength=Math.max(...FIELDS.map(f=>String(data[f]||'').length));rowEl.setAttribute('r',String(no));rowEl.setAttribute('ht',String(Math.min(405,Math.max(60,Math.ceil(maxLength/16)*15))));rowEl.setAttribute('customHeight','1');[...rowEl.getElementsByTagNameNS(ns,'c')].forEach(c=>{c.setAttribute('r',`${colName(c.getAttribute('r'))}${no}`);c.setAttribute('s',String(styleId));});FIELDS.forEach(f=>setCell(doc,rowEl,f,no,data[f],['J','N','P'].includes(f),styleId));setCell(doc,rowEl,'Q',no,ap(data.J,data.N,data.P),false,styleId);sheetData.appendChild(rowEl);});
      doc.getElementsByTagNameNS(ns,'dimension')[0].setAttribute('ref',`A1:AE${14+state.rows.length}`);zip.file('xl/worksheets/sheet1.xml',new XMLSerializer().serializeToString(doc));
      download(await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',compression:'DEFLATE'}),`DFMEA_${dateTag()}.xlsx`);
    }catch(error){console.error(error);alert('DFMEA导出失败：'+error.message);}finally{button.disabled=false;button.textContent='按原模板导出DFMEA';}
  }
  function styles(){return `
    .df-intro{display:flex;justify-content:space-between;gap:24px;align-items:center;background:linear-gradient(135deg,#fff 55%,#edf7f1)}.df-intro h3{font-size:25px;margin:4px 0}.df-intro p{margin:0;max-width:880px;color:var(--text-muted)}.df-kicker{font-size:11px;letter-spacing:.13em;font-weight:800;color:#367a2c}.df-counts{display:grid;grid-template-columns:auto auto;gap:2px 9px;white-space:nowrap}.df-counts b{font:700 23px var(--mono);color:#173b5e;text-align:right}.df-counts span{font-size:12px;align-self:center;color:#64748b}
    .df-library,.df-work{margin-top:14px}.df-section-head,.df-actionbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.df-section-head h3{margin:0}.df-section-head p{margin:4px 0 0;color:#64748b;font-size:12px}.df-filters{display:grid;grid-template-columns:minmax(250px,2fr) 160px 190px auto;gap:10px;margin-top:12px;align-items:end}.df-filters label{display:grid;gap:4px;font-size:12px;font-weight:700}.df-result-meta{display:flex;justify-content:space-between;gap:12px;margin:10px 0 6px;font-size:11px;color:#64748b}.df-library-list{border:1px solid #cbd5e1;max-height:390px;overflow:auto}.df-lib-row{display:grid;grid-template-columns:24px 155px minmax(260px,1fr) minmax(240px,1fr) 60px;gap:9px;align-items:center;padding:9px 10px;border-bottom:1px solid #e2e8f0;background:#fff}.df-lib-row:last-child{border:0}.df-lib-row:hover{background:#f8fafc}.df-lib-row input{width:auto}.df-lib-row b{display:block;font-size:12px}.df-lib-row small{display:block;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.df-level{font-size:10px;font-weight:800;border-radius:999px;padding:3px 7px;width:max-content}.df-level.l1{background:#e2e8f0}.df-level.l2{background:#dcfce7;color:#166534}.df-level.l3{background:#fef3c7;color:#92400e}.df-toolbar,.df-actionbar>div{display:flex;gap:6px;flex-wrap:wrap}.df-actionbar{margin:12px 0 8px}.df-actionbar>span{font-size:12px;color:#475569}
    .df-table-wrap{overflow:auto;border:1px solid #94a3b8;max-height:68vh}.df-table{border-collapse:separate;border-spacing:0;min-width:3400px;background:#fff}.df-table th,.df-table td{border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;vertical-align:top}.df-table th{position:sticky;top:0;z-index:2;padding:8px 6px;font-size:11px;text-align:left;min-width:165px}.df-table th small{display:block;font-family:var(--mono);opacity:.68}.df-table th.structure{background:#dbeafe}.df-table th.function{background:#dcfce7}.df-table th.failure{background:#fee2e2}.df-table th.risk{background:#d9f99d}.df-table th:nth-child(1){min-width:115px;width:115px}.df-table th:nth-child(2){min-width:120px;width:120px}.df-table th:nth-child(3){min-width:125px;width:125px}.df-table th:nth-child(4){min-width:150px;width:150px}.df-table th:nth-child(5){min-width:520px;width:520px}.df-table th:nth-child(6){min-width:235px}.df-table th:nth-child(7){min-width:270px}.df-table th:nth-child(9){min-width:250px}.df-table th:nth-child(10){min-width:330px}.df-table th:nth-child(11),.df-table th:nth-child(13){min-width:270px}.df-table th:nth-child(8),.df-table th:nth-child(12),.df-table th:nth-child(14),.df-table th:nth-child(15){min-width:76px;width:76px}.df-table textarea{display:block;width:100%;min-height:76px;border:0;border-radius:0;resize:vertical;padding:8px;font-size:12px;background:#fff}.df-table textarea:focus{outline:2px solid #2563eb;outline-offset:-2px}.df-table td.score{padding:6px;width:76px}.df-table td.score select{min-width:62px}.df-table td.ap{padding:14px;text-align:center}.df-table td.ap span{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;font-weight:900}.ap-h{background:#fee2e2;color:#b91c1c}.ap-m{background:#fef3c7;color:#92400e}.ap-l{background:#dcfce7;color:#166534}.df-table .operation{min-width:116px;width:116px;position:sticky;right:0;background:#fff}.df-table th.operation{z-index:3;background:#e2e8f0}.df-table td.operation{padding:6px;display:flex;gap:4px}.df-ap-note{font-size:11px;color:#64748b;margin:8px 0 0}
    @media(max-width:850px){.df-intro{align-items:flex-start;flex-direction:column}.df-filters{grid-template-columns:1fr 1fr}.df-filters label:first-child{grid-column:1/-1}.df-lib-row{grid-template-columns:24px 120px 1fr 60px}.df-lib-row>span:nth-of-type(3){display:none}}`}

  T.register({id:'dfmea',title:'DFMEA生成器',icon:'🧩',group:'工程文档与评审',desc:'基于原版Excel模板建立动力电池电气系统、部件和子零件三级DFMEA，并从底库快速填充。',
    captureDraft(){return {version:LIB.version,query:state.query,level:state.level,family:state.family,rows:state.rows};},
    restoreDraft(saved){
      const outdated=saved.version!==LIB.version,byId=new Map(LIB.rows.map((item)=>[item.id,item]));
      const rows=(saved.rows||[]).map((item)=>outdated&&item.sourceId&&byId.has(item.sourceId)?cloneRow(byId.get(item.sourceId)):item);
      state={...state,...saved,version:LIB.version,rows,selected:[]};render(hostRef);
    },resetDraft(){state={query:'',level:'全部',family:'全部',selected:[],rows:[]};render(hostRef);},render(host){render(host);}});
})();
