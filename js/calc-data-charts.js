(function () {
  'use strict';
  const C=window.DataChartsCore, T=window.ElectricalToolkit;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let project=C.defaults(), chart=null, observer=null, host=null, valid=false, revision=0;
  const history=[], future=[];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const $=s=>host.querySelector(s);
  function icon(type) {
    let shape='<rect x="4" y="21" width="7" height="13" fill="#ffc247"/><rect x="15" y="7" width="7" height="27" fill="#39ba9a"/><rect x="26" y="14" width="7" height="20" fill="#2589ef"/>';
    if(/line|step|area/.test(type)) shape='<path d="M4 31L12 20L20 24L28 9L35 4" fill="none" stroke="#2589ef" stroke-width="3"/>'+(type.includes('area')?'<path d="M4 31L12 20L20 24L28 9L35 4V35H4Z" fill="#39ba9a" opacity=".35"/>':'');
    if(/pie|donut|rose/.test(type)) shape='<circle cx="20" cy="20" r="16" fill="#2589ef"/><path d="M20 4A16 16 0 0 1 36 20H20Z" fill="#ffc247"/>'+(type==='donut'?'<circle cx="20" cy="20" r="8" fill="white"/>':'');
    if(type==='radar') shape='<path d="M20 2L37 14L31 34H9L3 14Z" fill="#2589ef" opacity=".7"/><path d="M20 9L30 17L25 29L12 25L10 15Z" fill="none" stroke="#ffc247" stroke-width="3"/>';
    if(type==='funnel') shape='<path d="M3 6H37V12H3Z" fill="#ffc247"/><path d="M8 16H32V22H8Z" fill="#39ba9a"/><path d="M14 26H26V32H14Z" fill="#9073df"/>';
    if(type==='scatter') shape='<g fill="#2589ef"><circle cx="8" cy="29" r="4"/><circle cx="16" cy="15" r="4"/><circle cx="29" cy="8" r="4"/></g><circle cx="29" cy="25" r="4" fill="#39ba9a"/>';
    if(type==='river') shape='<path d="M3 16Q10 3 20 15T37 14V32Q29 20 20 30T3 30Z" fill="#2589ef"/><path d="M3 24Q10 13 20 23T37 22V36H3Z" fill="#39ba9a"/>';
    if(type==='candlestick'||type==='waterfall') shape='<path d="M8 4V30M20 10V37M32 2V29" stroke="#39ba9a" stroke-width="2"/><path d="M8 10V24M32 8V20" stroke="#39ba9a" stroke-width="6"/><path d="M20 17V29" stroke="#f27884" stroke-width="6"/>';
    if(type.includes('horizontal')||type==='negative-bar') shape='<path d="M6 9H33" stroke="#2589ef" stroke-width="7"/><path d="M6 20H24" stroke="#ffc247" stroke-width="7"/><path d="M6 31H17" stroke="#39ba9a" stroke-width="7"/>';
    return `<svg viewBox="0 0 40 40" aria-hidden="true">${shape}</svg>`;
  }
  function status(message,error=false) {const el=$('.dc-status');el.textContent=message;el.dataset.error=String(error);}
  function notify() {host.dispatchEvent(new Event('change',{bubbles:true}));}
  function remember() {history.push(clone(project));if(history.length>40) history.shift();future.length=0;revision++;}
  function field(key,label,type='text',extra='') {return `<label class="dc-field">${label}<input data-setting="${key}" type="${type}" ${extra}></label>`;}
  function select(key,label,options) {return `<label class="dc-field">${label}<select data-setting="${key}">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>`;}
  function check(key,label) {return `<label class="dc-check"><input type="checkbox" data-setting="${key}">${label}</label>`;}
  function section(title,content,open=false) {return `<details ${open?'open':''}><summary>${title}</summary><div class="dc-fields">${content}</div></details>`;}
  function render(hostElement) {
    if(chart) chart.dispose(); if(observer) observer.disconnect();
    host=hostElement;history.length=0;future.length=0;
    host.innerHTML=`<div class="dc">
      <section class="dc-panel"><div class="dc-panel-head"><div><h3>选择图表</h3><p class="dc-note">21 种可视化方式 · 编辑数据，实时呈现</p></div><button class="btn btn-ghost" data-action="gallery">收起类型</button></div><div class="dc-gallery">${C.types.map(t=>`<button class="dc-type" data-type="${t.id}" aria-pressed="false">${icon(t.id)}<span>${t.name}</span></button>`).join('')}</div></section>
      <div class="dc-topline"><div class="dc-actions"><button class="btn btn-primary" data-action="import">导入数据 / 工程</button><input type="file" class="dc-file" accept=".csv,.tsv,.xlsx,.xls,.json" hidden><button class="btn btn-ghost" data-action="json">保存工程 JSON</button><button class="btn btn-ghost" data-action="csv">导出 CSV</button><button class="btn btn-ghost" data-action="xlsx">导出 Excel</button></div><span class="dc-note">所有数据仅在当前浏览器处理</span></div>
      <div class="dc-status" role="status" aria-live="polite"></div>
      <div class="dc-workspace"><div>
        <section class="dc-panel dc-preview"><div class="dc-panel-head"><h3>图表预览</h3><div class="dc-actions"><button class="btn btn-ghost" data-action="png">导出 PNG</button><button class="btn btn-ghost" data-action="svg">导出 SVG</button></div></div><div class="dc-preview-stage"><div class="dc-chart" role="img" aria-label="图表实时预览"></div></div><div class="dc-preview-footer"></div></section>
        <section class="dc-panel" style="margin-top:18px"><div class="dc-panel-head"><h3>数据编辑</h3><div class="dc-actions"><button class="btn btn-ghost" data-action="undo">撤销</button><button class="btn btn-ghost" data-action="redo">重做</button><button class="btn btn-ghost" data-action="example">载入当前类型示例</button></div></div><p class="dc-note dc-format"></p><p class="dc-note">点击单元格编辑；可直接粘贴 Excel 区域。列名对应图例，第一列对应分类 / 标签。空数值保留为缺失值。</p><div class="dc-table-wrap"></div><div class="dc-actions" style="margin-top:12px"><button class="btn btn-ghost" data-action="row">＋ 添加行</button><button class="btn btn-ghost" data-action="column">＋ 添加数值列</button></div><details class="dc-paste"><summary>粘贴整张表格 / CSV</summary><p class="dc-note">包含表头，支持制表符或逗号分隔；应用后替换当前数据。</p><textarea class="dc-paste-text" aria-label="粘贴表格数据" placeholder="分类,系列一,系列二&#10;项目 A,120,80"></textarea><button class="btn btn-primary" data-action="paste">应用表格数据</button></details></section>
      </div><aside class="dc-panel dc-settings"><h3>图表设置</h3><div class="dc-fields">
      ${section('标题与副标题',field('title','标题')+field('subtitle','副标题')+`<div class="dc-field-row">${select('titleAlign','对齐',[['left','居左'],['center','居中'],['right','居右']])}${field('titleSize','标题字号','number','min="12" max="48"')}</div>`,true)}
      ${section('图例',check('legend','显示图例')+select('legendPosition','位置',[['bottom','底部'],['top','顶部'],['left','左侧'],['right','右侧']])+'<p class="dc-note">在表头编辑系列名称。点击预览中的图例可显示或隐藏系列。</p>',true)}
      ${section('数据标签',check('labels','显示数据标签')+select('labelFormat','内容',[['value','数值'],['name','名称'],['percent','百分比（饼图类）']])+select('labelPosition','位置',[['top','上方 / 饼图外侧'],['inside','内部'],['bottom','下方 / 饼图外侧']])+field('labelSize','字号','number','min="8" max="28"'))}
      ${section('坐标轴与网格',check('axis','显示坐标轴')+check('grid','显示网格')+field('xName','X 轴名称')+field('yName','Y 轴名称')+`<div class="dc-field-row">${field('xMin','X 最小值','number','placeholder="自动"')}${field('xMax','X 最大值','number','placeholder="自动"')}</div><div class="dc-field-row">${field('yMin','Y 最小值','number','placeholder="自动"')}${field('yMax','Y 最大值','number','placeholder="自动"')}</div>`+field('rotate','分类标签旋转角度','number','min="-90" max="90"')+'<p class="dc-note">范围仅用于数值轴；横向条形图的数值轴为 X 轴。饼图、雷达图和河流图不使用这些数值轴配置。</p>')}
      ${section('配色与样式',field('background','画布背景','color')+field('textColor','文字颜色','color')+'<label class="dc-field">系列 / 分类配色</label><div class="dc-colors"></div>'+check('smooth','平滑折线')+check('animation','启用预览动画'))}
      ${section('画布与导出尺寸',`<div class="dc-field-row">${field('width','宽度 px','number','min="320" max="2400"')}${field('height','高度 px','number','min="240" max="1600"')}</div>`+'<p class="dc-note">预览按画布比例适配。PNG 以双倍像素导出，SVG 可无损缩放。</p>')}
      </div></aside></div></div>`;
    chart=window.echarts.init($('.dc-chart'),null,{renderer:'svg'});
    host.addEventListener('input',onInput);host.addEventListener('click',onClick);host.addEventListener('paste',onPaste);
    $('.dc-file').addEventListener('change',importFile);
    observer=new ResizeObserver(()=>{if(!host.isConnected){observer.disconnect();chart.dispose();return;}resize();});
    observer.observe($('.dc-preview-stage'));updateAll();
  }
  function tableUI() {
    $('.dc-table-wrap').innerHTML=`<table class="dc-table"><thead><tr><th>#</th>${project.table[0].map((v,c)=>`<th><div class="dc-cell-head"><input aria-label="第 ${c+1} 列名称" data-row="0" data-col="${c}" value="${esc(v)}">${c?`<button class="dc-remove" title="删除此数值列" aria-label="删除第 ${c+1} 列" data-delete-col="${c}">×</button>`:''}</div></th>`).join('')}<th></th></tr></thead><tbody>${project.table.slice(1).map((row,i)=>`<tr><td>${i+1}</td>${row.map((v,c)=>`<td><input aria-label="第 ${i+1} 行第 ${c+1} 列" data-row="${i+1}" data-col="${c}" value="${esc(v)}" ${c?'inputmode="decimal"':''}></td>`).join('')}<td><button class="dc-remove" aria-label="删除第 ${i+1} 行" data-delete-row="${i+1}">×</button></td></tr>`).join('')}</tbody></table>`;
  }
  function updateAll() {
    host.querySelectorAll('[data-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.type===project.type)));
    host.querySelectorAll('[data-setting]').forEach(input=>{const v=project.settings[input.dataset.setting];if(input.type==='checkbox')input.checked=v;else input.value=v;});
    $('.dc-colors').innerHTML=project.settings.colors.map((c,i)=>`<input type="color" data-color="${i}" aria-label="配色 ${i+1}" value="${c}">`).join('');
    const hints={candlestick:'需要 5 列：日期、开盘、收盘、最低、最高；按此顺序绘制。',scatter:'第一列为数值 X，其余列各为一组 Y 值。',river:'第一列为 YYYY-MM-DD 日期（不可重复），其余列为各系列的非负数值。',radar:'第一列为指标名称，每个数值列为一个系列；数值应非负。',waterfall:'第一列为阶段，第二列为增减量；负值表示减少，按行累计。'};
    $('.dc-format').textContent=hints[project.type]||(['pie','donut','rose','funnel'].includes(project.type)?'第一列为分类标签，第二列为非负数值；此类图表仅使用第一个数值列。':['bar','line','horizontal-bar','step'].includes(project.type)?'第一列为分类，第二列为数值。绘制多个数值列请选分组或堆叠类型。':'第一列为分类，其余数值列分别绘制为系列。');
    tableUI();preview();
  }
  function resize() {
    const width=Math.max(240,$('.dc-preview-stage').clientWidth-32), s=project.settings;
    const el=$('.dc-chart');el.style.height=Math.max(260,width*Number(s.height||540)/Number(s.width||960))+'px';
    chart.resize();
  }
  function preview() {
    try {
      chart.setOption(C.buildOption(project),true);valid=true;status('');resize();
      $('.dc-preview-footer').textContent=`${C.types.find(t=>t.id===project.type).name} · ${project.table.length-1} 行数据 · 画布 ${project.settings.width} × ${project.settings.height}`;
    } catch(error) {valid=false;chart.clear();status(error.message,true);$('.dc-preview-footer').textContent='请修正数据或配置后预览；也可载入当前类型示例。';}
    $('[data-action=undo]').disabled=!history.length;$('[data-action=redo]').disabled=!future.length;
    $('[data-action=png]').disabled=!valid;$('[data-action=svg]').disabled=!valid;
  }
  function onInput(event) {
    const el=event.target;
    if(el.matches('[data-row]')) {remember();project.table[Number(el.dataset.row)][Number(el.dataset.col)]=el.value;preview();}
    else if(el.dataset.setting) {remember();const key=el.dataset.setting;project.settings[key]=el.type==='checkbox'?el.checked:el.type==='number'&&el.value!==''?Number(el.value):el.value;preview();}
    else if(el.dataset.color!==undefined) {remember();project.settings.colors[Number(el.dataset.color)]=el.value;preview();}
  }
  function download(data,extension,mime) {
    const blob=data instanceof Blob?data:new Blob([data],{type:mime}); const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(project.settings.title||'数据图表').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function exportImage(format) {
    const p=C.normalizeProject(project), exportHost=host, token=window.ElUtil.editSession();let temporary;
    const box=document.createElement('div');box.style.cssText=`position:fixed;left:-10000px;top:0;width:${p.settings.width}px;height:${p.settings.height}px;`;document.body.appendChild(box);
    try {
      temporary=window.echarts.init(box,null,{renderer:format==='svg'?'svg':'canvas',width:p.settings.width,height:p.settings.height});
      temporary.setOption({...C.buildOption(p),animation:false});
      if(format==='svg') download(temporary.renderToSVGString(),'svg','image/svg+xml;charset=utf-8');
      else {const data=temporary.getDataURL({type:'png',pixelRatio:2,backgroundColor:p.settings.background});const blob=await (await fetch(data)).blob();if(host!==exportHost||!window.ElUtil.editSessionCurrent(token))return;download(blob,'png','image/png');}
      status('已导出 '+format.toUpperCase()+' 图片');
    } finally {if(temporary)temporary.dispose();box.remove();}
  }
  async function onClick(event) {
    const button=event.target.closest('button');if(!button)return;
    try {
      if(button.dataset.type) {remember();project.type=button.dataset.type;updateAll();notify();return;}
      if(button.dataset.deleteRow) {if(project.table.length<=2)throw new Error('至少保留一行数据');remember();project.table.splice(Number(button.dataset.deleteRow),1);tableUI();preview();notify();return;}
      if(button.dataset.deleteCol) {if(project.table[0].length<=2)throw new Error('至少保留一个数值列');remember();project.table.forEach(r=>r.splice(Number(button.dataset.deleteCol),1));tableUI();preview();notify();return;}
      const action=button.dataset.action;
      if(action==='gallery') {const gallery=$('.dc-gallery');gallery.hidden=!gallery.hidden;gallery.style.display=gallery.hidden?'none':'';button.textContent=gallery.hidden?'展开类型':'收起类型';}
      if(action==='import') $('.dc-file').click();
      if(action==='example') {if(!window.confirm('用当前类型示例替换表格数据？可通过撤销恢复。'))return;remember();project.table=C.defaults(project.type).table;updateAll();notify();}
      if(action==='undo'&&history.length) {future.push(clone(project));project=history.pop();revision++;updateAll();notify();}
      if(action==='redo'&&future.length) {history.push(clone(project));project=future.pop();revision++;updateAll();notify();}
      if(action==='row') {if(project.table.length>=2001)throw new Error('最多支持 2000 行');remember();project.table.push(project.table[0].map((_,i)=>i?0:'新分类'));tableUI();preview();notify();}
      if(action==='column') {if(project.table[0].length>=21)throw new Error('最多支持 20 个数值列');remember();project.table.forEach((r,i)=>r.push(i?0:'系列 '+r.length));tableUI();preview();notify();}
      if(action==='paste') {const table=C.normalizeTable(C.parseDelimited($('.dc-paste-text').value),project.type==='scatter');remember();project.table=table;updateAll();notify();}
      if(action==='json') {download(JSON.stringify(C.normalizeProject(project),null,2),'json','application/json');status('已保存数据与图表配置，可重新导入继续编辑');}
      if(action==='csv') {download(C.toCSV(C.normalizeTable(project.table)),'csv','text/csv;charset=utf-8');status('已导出 CSV 数据');}
      if(action==='xlsx') {const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(C.normalizeTable(project.table)),'图表数据');download(XLSX.write(wb,{bookType:'xlsx',type:'array'}),'xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');status('已导出 Excel 数据');}
      if(action==='png'||action==='svg') await exportImage(action);
    } catch(error) {status(error.message,true);}
  }
  function onPaste(event) {
    const el=event.target;if(!el.matches('[data-row]'))return;
    const text=event.clipboardData.getData('text');if(!/[\t\n\r]/.test(text))return;
    event.preventDefault();
    try {
      const cells=C.parseDelimited(text),r0=Number(el.dataset.row),c0=Number(el.dataset.col),next=clone(project.table);
      const rowCount=Math.max(next.length,r0+cells.length),colCount=Math.max(next[0].length,c0+Math.max(...cells.map(r=>r.length)));
      if(rowCount>2001||colCount>21)throw new Error('粘贴超出 2000 行 / 20 个数值列的限制');
      next.forEach((r,i)=>{while(r.length<colCount)r.push(i?null:'系列 '+r.length);});
      while(next.length<rowCount) next.push(Array.from({length:colCount},(_,c)=>c?null:'新分类'));
      cells.forEach((r,i)=>r.forEach((v,c)=>next[r0+i][c0+c]=v));
      remember();project.table=next;tableUI();preview();notify();
    } catch(error) {status(error.message,true);}
  }
  async function importFile(event) {
    const file=event.target.files[0];if(!file)return;
    const currentHost=host,currentRevision=revision;
    try {
      if(file.size>5*1024*1024)throw new Error('文件不能超过 5 MB');
      let next, sheetNote='';
      if(/\.json$/i.test(file.name)) next=C.normalizeProject(JSON.parse(await file.text()));
      else {
        let table;
        if(/\.xlsx?$/i.test(file.name)) {
          const wb=XLSX.read(await file.arrayBuffer(),{type:'array',sheetRows:2002});
          table=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null,raw:true,blankrows:false});
          sheetNote=`（工作表：${wb.SheetNames[0]}，读取首个工作表）`;
        } else if(/\.(csv|tsv)$/i.test(file.name)) table=C.parseDelimited(await file.text(),/\.tsv$/i.test(file.name)?'\t':undefined);
        else throw new Error('请选择 CSV、TSV、Excel 或图表工程 JSON');
        next={...clone(project),table:C.normalizeTable(table,project.type==='scatter')};
      }
      if(host!==currentHost||!currentHost.isConnected)return;
      if(revision!==currentRevision)throw new Error('文件读取期间数据已发生修改，请重新导入');
      remember();project=next;updateAll();notify();if(valid)status(`已导入 ${file.name}${sheetNote}`);
    } catch(error) {if(host===currentHost)status('导入失败：'+error.message,true);}
    finally {event.target.value='';}
  }
  T.register({id:'data-charts',title:'数据图表',group:'数据与文档',desc:'21 种图表 · 表格在线编辑 · 数据导入导出 · 标题、图例、标签与坐标自定义',render,
    validateDraft(saved) {try{C.normalizeProject(saved,{draft:true});return true;}catch{return false;}},
    captureDraft:()=>clone(project),
    restoreDraft(saved) {if(saved) {try{project=C.normalizeProject(saved,{draft:true});updateAll();}catch(error){status('草稿无法恢复：'+error.message,true);}}},
    refreshDraft:()=>updateAll(),
    resetDraft() {project=C.defaults();history.length=0;future.length=0;revision++;updateAll();}
  });
})();
