/** DVP&R 验证计划与报告生成器。 */
(function () {
  'use strict';
  const T = window.ElectricalToolkit;
  const E = window.ElUtil;
  const LIB = window.DVPR_LIBRARY;
  const STATUS = ['未开始','计划中','进行中','通过','不通过','有条件通过','取消'];
  const COLUMNS = [
    ['testItem','试验项目'],['standard','引用标准'],['clause','条款/章节主题'],['sampleQty','样品数量'],
    ['preMeasure','试验前测量'],['environment','环境/边界条件'],['procedure','试验方法/顺序'],['postMeasure','试验后测量'],
    ['acceptance','合格判据'],['owner','责任人'],['planStart','计划开始'],['planEnd','计划完成'],['status','状态'],['reportNo','报告编号/附件'],
  ];
  let hostRef;
  let state = freshState();

  function uid(){ return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function esc(v){ return E.escapeHtml(v == null ? '' : String(v)); }
  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function freshState(){ return {version:2, meta:{projectName:'新建DVP&R项目',partName:'',partNo:'',phase:'DV',revision:'A',preparedBy:'',preparedDate:today()},selectedProducts:[],selectedStandards:['内部数据库'],rows:[]}; }
  function product(id){ return LIB.products.find((item)=>item.id===id); }
  function normalizeRow(row){
    const base={id:uid(),sourceKey:'',productId:'',productName:'',testItem:'',standard:'项目技术规范',clause:'按项目受控版本确认',sampleQty:3,preMeasure:'',environment:'',procedure:'',postMeasure:'',acceptance:'',owner:'',planStart:'',planEnd:'',status:'未开始',reportNo:'',attachments:[]};
    const out={...base,...(row||{})}; out.id=out.id||uid(); out.attachments=Array.isArray(out.attachments)?out.attachments:[]; return out;
  }
  function normalize(saved){
    const base=freshState(); if(!saved||typeof saved!=='object')return base;
    return {...base,...saved,meta:{...base.meta,...(saved.meta||{})},selectedProducts:(saved.selectedProducts||[]).filter(id=>product(id)),selectedStandards:(saved.selectedStandards||[]).filter(id=>LIB.standards[id]),rows:(saved.rows||[]).map(normalizeRow)};
  }
  function formatBytes(n){ if(n<1024)return `${n} B`; if(n<1048576)return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; }
  function download(blob,name){ const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); }
  function fileSafe(v){ return String(v||'DVP&R').replace(/[\\/:*?\"<>|]+/g,'_').trim()||'DVP&R'; }

  function render(host){
    hostRef=host;
    const internalCount=Object.values(LIB.internalSourceStats||{}).reduce((sum,n)=>sum+Number(n||0),0);
    host.innerHTML=`<style>${styles()}</style>
      <section class="panel dv-hero"><div><span>DVP&amp;R · DESIGN VERIFICATION PLAN &amp; REPORT</span><h3>产品验证计划与报告生成器</h3><p>选择产品与目标标准，自动组合共性验证及零件专属验证；已融合内部数据库 ${internalCount} 条经验验证项，所有内容均可编辑。</p></div><div class="dv-actions">
        <button type="button" class="btn" id="dvJsonImportBtn">导入JSON</button><input hidden type="file" id="dvJsonImport" accept="application/json,.json">
        <button type="button" class="btn" id="dvJsonExport">导出JSON</button><button type="button" class="btn" id="dvExcelExport">导出Excel</button><button type="button" class="btn btn-primary" id="dvPdfExport">导出PDF</button>
      </div></section>
      <section class="panel dv-warning"><b>标准映射不是标准互认</b><p>不同体系的适用范围、试验顺序、严酷等级、样品分配与限值可能不同。自动生成内容仅作为DVP&amp;R起始建议，正式签署前必须使用项目指定的受控版本逐条复核。</p></section>
      <section class="panel"><h3>1. 项目信息</h3><div class="dv-meta">${metaField('projectName','项目名称')}${metaField('partName','零件/总成名称')}${metaField('partNo','零件号')}${metaSelect('phase','阶段',['DV','PV','DV+PV','型式试验','年度验证'])}${metaField('revision','版本')}${metaField('preparedBy','编制人')}${metaField('preparedDate','编制日期','date')}</div></section>
      <section class="panel"><div class="dv-head"><div><h3>2. 产品与标准</h3><p>可同时选择多个零件；“推荐标准”会将所选产品底库引用的标准一并勾选。</p></div><div><button type="button" class="btn" id="dvRecommend">选择推荐标准</button><button type="button" class="btn btn-primary" id="dvGenerate">生成/补充验证矩阵</button></div></div>
        <h4>产品</h4><div class="dv-products">${LIB.products.map((p)=>`<label><input type="checkbox" data-product="${p.id}" ${state.selectedProducts.includes(p.id)?'checked':''}><span><b>${esc(p.name)}</b><small>${esc(p.category)}</small></span></label>`).join('')}</div>
        <h4>目标标准</h4><div class="dv-standards">${Object.entries(LIB.standards).map(([id,s])=>`<label title="${esc(s.title)}" class="${id==='内部数据库'?'dv-internal-standard':''}"><input type="checkbox" data-standard="${esc(id)}" ${state.selectedStandards.includes(id)?'checked':''}><span><b>${esc(id)}</b><small>${esc(s.family)} · ${esc(s.title)}</small></span></label>`).join('')}</div>
      </section>
      <section class="panel"><div class="dv-head"><div><h3>3. 标准体系映射提示</h3><p>仅用于梳理相近验证主题，不代表等效替代。</p></div></div><div class="dv-mappings">${LIB.mappings.map((m)=>`<article><b>${m.systems.map(esc).join(' ↔ ')}</b><span>${esc(m.scope)}</span><p>${esc(m.note)}</p><em>不等效</em></article>`).join('')}</div></section>
      <section class="panel"><div class="dv-head"><div><h3>4. 当前DVP&amp;R工作区</h3><p>共 <b id="dvRowCount">${state.rows.length}</b> 条。支持从Excel复制多行多列，在任意单元格直接粘贴。</p></div><div><button type="button" class="btn" id="dvAddRow">添加空白行</button><button type="button" class="btn danger" id="dvClear">清空工作区</button></div></div>
        <div class="dv-table-wrap"><table class="dv-table"><thead><tr><th>产品</th>${COLUMNS.map(([,label])=>`<th>${label}</th>`).join('')}<th>操作</th></tr></thead><tbody id="dvRows">${rowsHtml()}</tbody></table></div>
      </section><div id="dvPrintShell" class="dv-print-shell"></div>`;
    bind();
  }
  function metaField(key,label,type='text'){ return `<label><span>${label}</span><input data-meta="${key}" type="${type}" value="${esc(state.meta[key])}"></label>`; }
  function metaSelect(key,label,values){ return `<label><span>${label}</span><select data-meta="${key}">${values.map(v=>`<option${state.meta[key]===v?' selected':''}>${v}</option>`).join('')}</select></label>`; }
  function rowsHtml(){ return state.rows.length ? state.rows.map(rowHtml).join('') : '<tr><td class="dv-empty" colspan="16">尚无验证条目。请选择产品并生成矩阵，或添加空白行。</td></tr>'; }
  function textarea(row,key,type='text'){
    if(key==='sampleQty')return `<input data-field="${key}" type="text" value="${esc(row[key])}" placeholder="如 3 / ALL">`;
    if(key==='planStart'||key==='planEnd')return `<input data-field="${key}" type="date" value="${esc(row[key])}">`;
    if(key==='status')return `<select data-field="status">${STATUS.map(v=>`<option${row.status===v?' selected':''}>${v}</option>`).join('')}</select>`;
    return `<textarea data-field="${key}">${esc(row[key])}</textarea>`;
  }
  function rowHtml(row){
    const attachments=row.attachments||[];
    return `<tr data-row="${row.id}"><td class="dv-product-cell"><select data-field="productId">${LIB.products.map(p=>`<option value="${p.id}"${p.id===row.productId?' selected':''}>${esc(p.name)}</option>`).join('')}<option value=""${row.productId?'':' selected'}>自定义</option></select><input data-field="productName" value="${esc(row.productName)}" placeholder="自定义名称"></td>
      ${COLUMNS.map(([key])=>`<td>${key==='reportNo'?`${textarea(row,key)}<div class="dv-files">${attachments.map((f,i)=>`<span title="${esc(f.name)}">${esc(f.name)} (${formatBytes(f.size||0)}) <a href="${esc(f.dataUrl||'#')}" download="${esc(f.name)}">下载</a> <button type="button" data-remove-file="${i}">×</button></span>`).join('')}<label>添加附件<input type="file" multiple data-attach></label></div>`:textarea(row,key)}</td>`).join('')}
      <td class="dv-op"><button type="button" data-copy>复制</button><button type="button" data-delete>删除</button></td></tr>`;
  }
  function renderRows(){ const tbody=hostRef.querySelector('#dvRows');tbody.innerHTML=rowsHtml();hostRef.querySelector('#dvRowCount').textContent=state.rows.length; }

  function bind(){
    hostRef.querySelectorAll('[data-meta]').forEach(el=>el.addEventListener('input',()=>{state.meta[el.dataset.meta]=el.value;}));
    hostRef.querySelectorAll('[data-product]').forEach(el=>el.addEventListener('change',()=>{state.selectedProducts=[...hostRef.querySelectorAll('[data-product]:checked')].map(x=>x.dataset.product);}));
    hostRef.querySelectorAll('[data-standard]').forEach(el=>el.addEventListener('change',()=>{state.selectedStandards=[...hostRef.querySelectorAll('[data-standard]:checked')].map(x=>x.dataset.standard);}));
    hostRef.querySelector('#dvRecommend').addEventListener('click',selectRecommended);
    hostRef.querySelector('#dvGenerate').addEventListener('click',generateRows);
    hostRef.querySelector('#dvAddRow').addEventListener('click',()=>{state.rows.push(normalizeRow({productId:state.selectedProducts[0]||'',productName:product(state.selectedProducts[0])?.name||''}));renderRows();});
    hostRef.querySelector('#dvClear').addEventListener('click',()=>{if(confirm('确定清空当前DVP&R工作区的全部条目吗？此操作不会清除已导出的JSON文件。')){state.rows=[];renderRows();}});
    hostRef.querySelector('#dvRows').addEventListener('input',onTableInput);
    hostRef.querySelector('#dvRows').addEventListener('change',onTableInput);
    hostRef.querySelector('#dvRows').addEventListener('click',onTableClick);
    hostRef.querySelector('#dvRows').addEventListener('paste',onPaste);
    hostRef.querySelector('#dvRows').addEventListener('change',onFileChange);
    hostRef.querySelector('#dvJsonImportBtn').addEventListener('click',()=>hostRef.querySelector('#dvJsonImport').click());
    hostRef.querySelector('#dvJsonImport').addEventListener('change',importJson);
    hostRef.querySelector('#dvJsonExport').addEventListener('click',exportJson);
    hostRef.querySelector('#dvExcelExport').addEventListener('click',exportExcel);
    hostRef.querySelector('#dvPdfExport').addEventListener('click',exportPdf);
  }
  function selectRecommended(){
    const set=new Set(); state.selectedProducts.forEach(id=>{ const p=product(id);(p?.recommendedStandards||[]).forEach(s=>set.add(s));(LIB.profiles[id]||[]).forEach(test=>set.add(test[1])); });
    state.selectedStandards=[...set].filter(s=>LIB.standards[s]);render(hostRef);
  }
  function generateRows(){
    if(!state.selectedProducts.length){alert('请至少选择一种产品。');return;}
    if(!state.selectedStandards.length)selectRecommended();
    const exists=new Set(state.rows.map(r=>r.sourceKey)); let added=0;
    state.selectedProducts.forEach(productId=>{
      const p=product(productId);
      (LIB.profiles[productId]||[]).forEach((test,index)=>{
        const [testItem,standard,clause,sampleQty,preMeasure,environment,procedure,postMeasure,acceptance]=test;
        if(!state.selectedStandards.includes(standard))return;
        const sourceKey=`${productId}|${index}|${standard}|${testItem}`;if(exists.has(sourceKey))return;
        state.rows.push(normalizeRow({sourceKey,productId,productName:p.name,testItem,standard,clause,sampleQty,preMeasure,environment,procedure,postMeasure,acceptance}));exists.add(sourceKey);added++;
      });
    });
    renderRows();alert(added?`已新增 ${added} 条验证项目。`:'没有新增条目：当前产品与标准组合已在工作区中。');
  }
  function findRow(target){ const tr=target.closest('[data-row]');return tr?state.rows.find(r=>r.id===tr.dataset.row):null; }
  function onTableInput(event){ const row=findRow(event.target);const key=event.target.dataset.field;if(!row||!key)return;row[key]=event.target.value;if(key==='productId'&&row[key]){row.productName=product(row[key])?.name||row.productName;const nameInput=event.target.closest('td')?.querySelector('[data-field="productName"]');if(nameInput)nameInput.value=row.productName;} }
  function onTableClick(event){
    const row=findRow(event.target);if(!row)return;const index=state.rows.indexOf(row);
    if(event.target.closest('[data-delete]')){state.rows.splice(index,1);renderRows();}
    else if(event.target.closest('[data-copy]')){state.rows.splice(index+1,0,normalizeRow({...clone(row),id:uid(),sourceKey:''}));renderRows();}
    else if(event.target.dataset.removeFile!=null){row.attachments.splice(Number(event.target.dataset.removeFile),1);renderRows();}
  }
  async function onFileChange(event){
    if(!event.target.matches('[data-attach]'))return;const row=findRow(event.target);if(!row)return;
    const files=[...event.target.files];for(const file of files){if(file.size>12*1024*1024){alert(`${file.name} 超过12MB，未添加。`);continue;}row.attachments.push({name:file.name,type:file.type||'application/octet-stream',size:file.size,dataUrl:await readDataUrl(file)});}renderRows();
  }
  function readDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}
  function onPaste(event){
    const cell=event.target.closest('td');const tr=event.target.closest('tr');if(!cell||!tr)return;const text=event.clipboardData?.getData('text/plain');if(!text||(!text.includes('\t')&&!/[\r\n]/.test(text)))return;
    event.preventDefault();const rowIndex=state.rows.findIndex(r=>r.id===tr.dataset.row);const field=event.target.dataset.field;const colIndex=COLUMNS.findIndex(([key])=>key===field);if(rowIndex<0||colIndex<0)return;
    const matrix=text.replace(/\r/g,'').split('\n').filter((line,i,a)=>line!==''||i<a.length-1).map(line=>line.split('\t'));
    matrix.forEach((values,ri)=>{while(state.rows.length<=rowIndex+ri)state.rows.push(normalizeRow({productId:state.rows[rowIndex]?.productId||'',productName:state.rows[rowIndex]?.productName||''}));values.forEach((value,ci)=>{const def=COLUMNS[colIndex+ci];if(def)state.rows[rowIndex+ri][def[0]]=value;});});renderRows();
  }
  function exportJson(){download(new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),`${fileSafe(state.meta.projectName)}_DVPR.json`);}
  async function importJson(event){
    const file=event.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());state=normalize(parsed);render(hostRef);alert(`已导入 ${state.rows.length} 条验证项目，附件已一并恢复。`);}catch(error){alert(`JSON导入失败：${error.message}`);}event.target.value='';
  }
  function sheetRows(){
    const meta=state.meta;return [
      ['DVP&R / 设计验证计划与报告'],['项目名称',meta.projectName,'零件/总成',meta.partName,'零件号',meta.partNo],['阶段',meta.phase,'版本',meta.revision,'编制人',meta.preparedBy,'日期',meta.preparedDate],[],
      ['序号','产品',...COLUMNS.map(([,label])=>label)],
      ...state.rows.map((r,i)=>[i+1,r.productName||product(r.productId)?.name||'',...COLUMNS.map(([key])=>key==='reportNo'?[r.reportNo,...(r.attachments||[]).map(f=>f.name)].filter(Boolean).join('\n'):r[key])]),
    ];
  }
  function exportExcel(){
    if(!state.rows.length){alert('请先生成或添加至少一条验证项目。');return;}if(!window.XLSX){alert('Excel导出组件未加载。');return;}
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(sheetRows());
    ws['!cols']=[{wch:6},{wch:18},{wch:22},{wch:18},{wch:25},{wch:10},{wch:24},{wch:28},{wch:28},{wch:24},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:22}];
    ws['!freeze']={xSplit:2,ySplit:5};ws['!autofilter']={ref:`A5:P${5+state.rows.length}`};ws['!merges']=[XLSX.utils.decode_range('A1:P1')];
    XLSX.utils.book_append_sheet(wb,ws,'DVP&R');
    const map=XLSX.utils.aoa_to_sheet([['标准体系映射（仅表示验证主题相近，不代表等效或互认）'],['标准体系','相近范围','等效性','差异提示'],...LIB.mappings.map(m=>[m.systems.join(' ↔ '),m.scope,'不等效',m.note])]);map['!cols']=[{wch:42},{wch:38},{wch:12},{wch:80}];map['!merges']=[XLSX.utils.decode_range('A1:D1')];XLSX.utils.book_append_sheet(wb,map,'标准映射提示');
    XLSX.writeFile(wb,`${fileSafe(state.meta.projectName)}_DVPR.xlsx`);
  }
  function reportHtml(){
    const m=state.meta;return `<article class="dv-report"><header><h1>DVP&amp;R 设计验证计划与报告</h1><p>${esc(m.projectName)} · ${esc(m.partName)} · ${esc(m.partNo)}</p></header><table class="dv-report-meta"><tr><th>阶段</th><td>${esc(m.phase)}</td><th>版本</th><td>${esc(m.revision)}</td><th>编制人/日期</th><td>${esc(m.preparedBy)} / ${esc(m.preparedDate)}</td></tr></table><p class="dv-report-note"><b>注意：</b>相近标准不代表等效互认；试验条件、样品数量与判据须按项目受控版本复核。</p><table class="dv-report-table"><thead><tr><th>序号/产品</th>${COLUMNS.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${state.rows.map((r,i)=>`<tr><td>${i+1}<br>${esc(r.productName||product(r.productId)?.name||'')}</td>${COLUMNS.map(([key])=>`<td>${key==='reportNo'?`${esc(r.reportNo)}${(r.attachments||[]).length?`<br>附件：${r.attachments.map(f=>esc(f.name)).join('；')}`:''}`:esc(r[key])}</td>`).join('')}</tr>`).join('')}</tbody></table><h2>标准映射说明</h2>${LIB.mappings.map(m=>`<p><b>${m.systems.map(esc).join(' ↔ ')}：</b>${esc(m.note)}</p>`).join('')}</article>`;
  }
  function exportPdf(){
    if(!state.rows.length){alert('请先生成或添加至少一条验证项目。');return;}const shell=hostRef.querySelector('#dvPrintShell');shell.innerHTML=reportHtml();shell.classList.add('active');const parent=shell.parentNode,next=shell.nextSibling;document.body.appendChild(shell);const oldTitle=document.title;document.title=`${fileSafe(state.meta.projectName)}_DVPR`;const restore=()=>{document.title=oldTitle;shell.classList.remove('active');parent.insertBefore(shell,next);window.removeEventListener('afterprint',restore);};window.addEventListener('afterprint',restore);setTimeout(()=>window.print(),150);
  }

  function styles(){return `
    .dv-hero,.dv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.dv-hero{background:linear-gradient(135deg,#fff 50%,#eaf3f8);border-left:4px solid #173b5e}.dv-hero span{font-size:11px;letter-spacing:.12em;color:#2f6e88;font-weight:800}.dv-hero h3{font-size:25px;margin:4px 0}.dv-hero p,.dv-head p{margin:3px 0;color:var(--text-muted)}.dv-actions,.dv-head>div:last-child{display:flex;gap:7px;flex-wrap:wrap}.dv-warning{border-left:4px solid #b7791f;background:#fff8e8}.dv-warning p{margin:4px 0 0}.dv-meta{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}.dv-meta label{display:grid;gap:4px}.dv-meta span{font-size:12px;font-weight:700}.dv-products,.dv-standards{display:grid;grid-template-columns:repeat(4,minmax(180px,1fr));gap:7px}.dv-products label,.dv-standards label{display:flex;gap:8px;align-items:flex-start;border:1px solid #cbd5e1;padding:8px;background:#fff}.dv-standards label.dv-internal-standard{border:2px solid #b7791f;background:#fffbeb}.dv-products input,.dv-standards input{width:auto;margin-top:3px}.dv-products span,.dv-standards span{display:grid;min-width:0}.dv-products small,.dv-standards small{color:#64748b;font-size:10px;overflow:hidden;text-overflow:ellipsis}.dv-mappings{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.dv-mappings article{position:relative;border:1px solid #cbd5e1;padding:12px;background:#fff}.dv-mappings article>b,.dv-mappings article>span{display:block}.dv-mappings article>span{margin-top:5px}.dv-mappings article p{font-size:12px;color:#64748b;margin-bottom:0}.dv-mappings em{position:absolute;top:8px;right:8px;color:#b42318;background:#fee2e2;padding:2px 6px;font-style:normal;font-size:10px}.dv-table-wrap{overflow:auto;max-height:70vh;border:1px solid #94a3b8;margin-top:10px}.dv-table{border-collapse:separate;border-spacing:0;min-width:3050px;background:#fff}.dv-table th,.dv-table td{border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;vertical-align:top}.dv-table th{position:sticky;top:0;z-index:2;background:#e6eef5;padding:7px;font-size:11px;min-width:150px}.dv-table th:nth-child(1){min-width:170px}.dv-table th:nth-child(2){min-width:180px}.dv-table th:nth-child(4){min-width:230px}.dv-table th:nth-child(5){min-width:75px}.dv-table th:nth-child(6),.dv-table th:nth-child(9){min-width:210px}.dv-table th:nth-child(7),.dv-table th:nth-child(8),.dv-table th:nth-child(10){min-width:260px}.dv-table th:nth-child(15){min-width:230px}.dv-table th:last-child{position:sticky;right:0;z-index:3;min-width:105px}.dv-table td:last-child{position:sticky;right:0;background:#fff}.dv-table textarea,.dv-table input,.dv-table select{width:100%;min-width:0;border:0;border-radius:0;min-height:58px;padding:7px;background:#fff;resize:vertical}.dv-table input[type=date],.dv-table input[data-field=sampleQty],.dv-table select{min-height:38px}.dv-product-cell{padding:4px}.dv-product-cell input,.dv-product-cell select{min-height:35px}.dv-op{padding:5px;display:flex;gap:3px}.dv-op button,.dv-files button{cursor:pointer}.dv-files{display:grid;gap:3px;padding:4px}.dv-files span{font-size:10px;background:#edf2f7;padding:3px}.dv-files label{font-size:11px;color:#175d7b;cursor:pointer}.dv-files input{display:none}.dv-empty{text-align:center;padding:30px!important;color:#64748b}.danger{color:#b42318;border-color:#e5a8a8}.dv-print-shell{display:none}
    @media(max-width:900px){.dv-hero,.dv-head{flex-direction:column}.dv-meta,.dv-products,.dv-standards,.dv-mappings{grid-template-columns:1fr}}
    @media print{@page{size:A4 landscape;margin:8mm}html,body{height:auto!important;min-height:0!important;background:#fff!important}body>*:not(.dv-print-shell){display:none!important}.dv-print-shell.active{display:block!important;color:#111!important;font-family:'Microsoft YaHei',Arial,sans-serif}.dv-report{font-size:6.5pt}.dv-report header{border-bottom:2px solid #173b5e;margin-bottom:3mm}.dv-report h1{font-size:16pt;margin:0}.dv-report header p{font-size:9pt}.dv-report table{width:100%;border-collapse:collapse;table-layout:fixed}.dv-report th,.dv-report td{border:1px solid #777;padding:1mm;vertical-align:top;word-break:break-word;white-space:pre-wrap}.dv-report th{background:#e8eef3}.dv-report-meta{font-size:8pt}.dv-report-note{border-left:3px solid #b7791f;padding:2mm;background:#fff7df}.dv-report-table{font-size:5.8pt}.dv-report-table th:nth-child(1){width:7%}.dv-report-table th:nth-child(5),.dv-report-table th:nth-child(11),.dv-report-table th:nth-child(12),.dv-report-table th:nth-child(13){width:4%}.dv-report-table tr{break-inside:avoid}.dv-report h2{font-size:10pt;margin:4mm 0 1mm}}
  `;}

  T.register({id:'dvpr',title:'DVP&R生成器',icon:'🧪',group:'工程文档与评审',desc:'按产品与目标标准生成可编辑验证矩阵，支持附件、JSON续编以及Excel/PDF报告。',render,
    captureDraft:()=>clone(state),restoreDraft(saved){state=normalize(saved);render(hostRef);},resetDraft(){state=freshState();render(hostRef);}});
})();
