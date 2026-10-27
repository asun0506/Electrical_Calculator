(function () {
  'use strict';
  const C=window.DataChartsCore, T=window.ElectricalToolkit;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let project=C.defaults(), chart=null, observer=null, host=null, valid=false, revision=0;
  let collection=C.normalizeCollection(project), history=[], future=[];
  const chartHistories=new Map();
  const clone=v=>JSON.parse(JSON.stringify(v));
  const $=s=>host.querySelector(s);
  function icon(type) {
    const blue='#2497ed',cyan='#16c8e8',green='#50bd76',yellow='#ffc528',purple='#9250df',pink='#f56383';
    const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
    const path=(d,stroke,fill='none',width=2)=>`<path d="${d}" stroke="${stroke}" fill="${fill}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const dot=(x,y,fill,r=3)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
    const axes=path('M5 4V35H37','#6f8490','none',1.6);
    const shapes={
      bar:rect(6,23,7,12,yellow)+rect(17,4,7,31,green)+rect(28,12,7,23,blue),
      radar:path('M20 2L36 11V29L20 38L4 29V11Z',cyan,blue,1)+path('M20 2V38M4 11L36 29M4 29L36 11','#69cafa','none',1)+path('M20 8L29 14L26 28L13 31L10 15Z',yellow,'#ffc52833',2),
      line:axes+path('M8 29L13 22L18 25L23 13L28 17L35 6',blue),
      pie:'<circle cx="20" cy="20" r="17" fill="'+blue+'"/>'+path('M20 3A17 17 0 0 1 37 20H20Z','none',yellow,0)+path('M20 20H37A17 17 0 0 1 31 33Z','none',green,0),
      rose:path('M19 21L19 5A16 16 0 1 0 25 36Z','none','#ff0050',0)+path('M22 18V2A16 16 0 0 1 38 18Z','none','#ff9b25',0)+path('M23 21H36A13 13 0 0 1 28 33Z','none',blue,0),
      candlestick:axes+path('M11 16V31M19 9V27M27 11V31M35 4V22',green,'none',1.5)+rect(9,20,4,8,green)+rect(17,13,4,9,pink)+rect(25,16,4,10,green)+rect(33,8,4,9,green)+path('M8 13L17 6L25 9L35 3',yellow,'none',1.5),
      river:path('M3 13Q6 7 10 12T17 12T24 12T31 12T38 12V33H3Z','none','#69e0ef',0)+path('M3 20Q6 14 10 19T17 19T24 19T31 19T38 19V33H3Z','none',cyan,0)+path('M3 27Q6 21 10 26T17 26T24 26T31 26T38 26V34H3Z','none',blue,0)+path('M3 33Q6 27 10 32T17 32T24 32T31 32T38 32V37H3Z','none','#6347ed',0),
      donut:'<circle cx="20" cy="20" r="13" fill="none" stroke="'+blue+'" stroke-width="9"/>'+path('M20 7A13 13 0 0 1 33 20',yellow,'none',9)+path('M33 20A13 13 0 0 1 29.2 29.2',pink,'none',9),
      scatter:rect(4,4,32,32,'#ffffff')+path('M4 4H36V36H4ZM4 14H36M4 25H36M14 4V36M25 4V36','#81949d','none',1.3)+dot(12,29,blue,4)+dot(23,10,yellow,4)+dot(29,22,green,4),
      funnel:rect(2,4,36,5,'#ffe04d')+rect(6,11,28,5,'#ffb747')+rect(10,18,20,5,'#8fdb71')+rect(14,25,12,5,cyan)+rect(17,32,6,5,'#ad76eb'),
      'grouped-bar':rect(3,23,4,13,cyan)+rect(7,5,4,31,purple)+rect(11,12,4,24,green)+rect(22,20,4,16,cyan)+rect(26,11,4,25,purple)+rect(30,26,4,10,green),
      'grouped-line':axes+path('M8 18L18 9L28 21L36 14',cyan)+path('M8 31L18 22L28 29L36 17','#ff9852'),
      waterfall:axes+rect(8,28,4,7,pink)+rect(14,16,4,12,green)+rect(20,16,4,7,purple)+rect(26,10,4,13,'#ff9b25')+rect(32,10,4,6,blue)+path('M12 28H14M18 16H20M24 23H26M30 10H32','#a6b1ba','none',1),
      area:axes+path('M7 33L13 24L19 26L25 18L31 20L37 10V35H7Z','none',purple,0)+path('M7 31L13 20L19 22L25 12L31 14L37 4V19L31 25L25 23L19 30L13 29L7 35Z','none',cyan,0),
      'horizontal-bar':axes+rect(8,8,18,6,blue)+rect(8,18,27,6,yellow)+rect(8,28,14,6,green),
      step:axes+path('M8 30H15V21H22V25H29V10H36',blue)+dot(8,30,pink,2.7)+dot(15,21,yellow,2.7)+dot(22,25,green,2.7)+dot(29,10,cyan,2.7),
      'stacked-bar':rect(4,24,6,12,purple)+rect(4,11,6,13,cyan)+rect(14,29,6,7,purple)+rect(14,23,6,6,cyan)+rect(24,14,6,22,purple)+rect(24,3,6,11,cyan)+rect(34,29,4,7,purple)+rect(34,14,4,15,cyan),
      'negative-bar':path('M20 3V37','#b2bec8','none',2)+rect(7,6,13,4,green)+rect(20,6,13,4,green)+rect(3,14,17,4,pink)+rect(20,14,17,4,pink)+rect(12,22,8,4,yellow)+rect(20,22,15,4,yellow)+rect(8,30,12,4,blue)+rect(20,30,7,4,blue),
      'stacked-horizontal':rect(3,6,12,6,purple)+rect(15,6,12,6,cyan)+rect(3,15,6,6,purple)+rect(9,15,7,6,cyan)+rect(3,24,24,6,purple)+rect(27,24,10,6,cyan)+rect(3,33,9,5,purple)+rect(12,33,12,5,cyan),
      'grouped-horizontal':rect(3,4,13,4,cyan)+rect(3,8,32,4,purple)+rect(3,12,25,4,green)+rect(3,23,17,4,cyan)+rect(3,27,27,4,purple)+rect(3,31,11,4,green),
      'stacked-area':axes+path('M7 23L14 22L21 13L28 14L37 8V35H7Z','none','#318c44',0)+path('M7 29L14 27L21 22L28 24L37 17V35H7Z','none','#4faf55',0)+path('M7 33L14 31L21 28L28 30L37 25V35H7Z','none','#79cc73',0)
    };
    return `<svg viewBox="0 0 40 40" aria-hidden="true">${shapes[type]||shapes.bar}</svg>`;
  }
  function status(message,error=false) {const el=$('.dc-status');el.textContent=message;el.dataset.error=String(error);}
  function notify() {host.dispatchEvent(new Event('change',{bubbles:true}));}
  function remember() {history.push(clone(project));if(history.length>40) history.shift();future.length=0;revision++;}
  function captureCollection() {
    collection.charts.find(item=>item.id===collection.activeId).chart=project;
    collection.activeByType[project.type]=collection.activeId;
    return clone(collection);
  }
  function chartsOfType() {return collection.charts.filter(item=>(item.id===collection.activeId?project:item.chart).type===project.type);}
  function chartList() {
    const control=$('[data-chart-select]'),items=chartsOfType();
    $('.dc-current-type').textContent=C.types.find(type=>type.id===project.type).name+' · 当前图表';
    control.innerHTML=items.map((item,i)=>{
      const title=item.id===collection.activeId?project.settings.title:item.chart.settings.title;
      const duplicate=items.filter(other=>(other.id===collection.activeId?project.settings.title:other.chart.settings.title)===title).length>1;
      return `<option value="${esc(item.id)}">${esc(title.trim()||'未命名图表')}${duplicate||!title.trim()?'（'+(i+1)+'）':''}</option>`;
    }).join('');control.value=collection.activeId;
    $('[data-action=delete-chart]').disabled=items.length===1;
    $('.dc-chart-count').textContent=`当前类型 ${items.length} 张 · 项目共 ${collection.charts.length} 张`;
  }
  function switchChart(id) {
    if(!collection.charts.some(item=>item.id===id)||collection.activeId===id)return;
    captureCollection();chartHistories.set(collection.activeId,{history,future});
    collection.activeId=id;project=collection.charts.find(item=>item.id===id).chart;
    collection.activeByType[project.type]=id;
    ({history,future}=chartHistories.get(id)||{history:[],future:[]});revision++;
    $('.dc-paste-text').value='';updateAll();notify();
  }
  function switchType(type) {
    if(type===project.type)return;
    captureCollection();
    let target=collection.charts.find(item=>item.id===collection.activeByType[type]&&item.chart.type===type)||collection.charts.find(item=>item.chart.type===type);
    if(!target) {
      if(collection.charts.length>=100)throw new Error('每个项目最多支持 100 张图表');
      const next=C.defaults(type);next.settings.title=C.types.find(item=>item.id===type).name+' 1';
      target={id:crypto.randomUUID(),chart:next};collection.charts.push(target);
    }
    switchChart(target.id);
  }
  function restoreCollection(saved) {
    collection=C.normalizeCollection(saved,{draft:true});
    project=collection.charts.find(item=>item.id===collection.activeId).chart;
    chartHistories.clear();history=[];future=[];revision++;updateAll();
  }
  function field(key,label,type='text',extra='') {return `<label class="dc-field">${label}<input data-setting="${key}" type="${type}" ${extra}></label>`;}
  function select(key,label,options) {return `<label class="dc-field">${label}<select data-setting="${key}">${options.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label>`;}
  function check(key,label) {return `<label class="dc-check"><input type="checkbox" data-setting="${key}">${label}</label>`;}
  function section(title,content,open=false) {return `<details ${open?'open':''}><summary>${title}</summary><div class="dc-fields">${content}</div></details>`;}
  function render(hostElement) {
    if(chart) chart.dispose(); if(observer) observer.disconnect();
    host=hostElement;history.length=0;future.length=0;
    host.innerHTML=`<div class="dc">
      <section class="dc-panel"><div class="dc-panel-head"><div><h3>图表类型</h3><p class="dc-note">先选择类型，再选择该类型下的命名图表；各类型独立保存。</p></div><button class="btn btn-ghost" data-action="gallery">收起类型</button></div><div class="dc-gallery">${C.types.map(t=>`<button class="dc-type" data-type="${t.id}" aria-pressed="false">${icon(t.id)}<span>${t.name}</span></button>`).join('')}</div></section>
      <section class="dc-panel dc-chart-toolbar"><label class="dc-current-chart"><span class="dc-current-type"></span><select data-chart-select aria-label="按标题选择当前类型的图表"></select></label><div class="dc-actions"><button class="btn btn-primary" data-action="new-chart">＋ 新建同类型图表</button><button class="btn btn-ghost" data-action="copy-chart">复制图表</button><button class="btn btn-ghost" data-action="delete-chart">删除图表</button><button class="btn btn-ghost" data-action="all-json">保存全部图表 JSON</button></div><span class="dc-note dc-chart-count"></span></section>
      <div class="dc-topline"><div class="dc-actions"><button class="btn btn-primary" data-action="import">导入数据 / 图表</button><input type="file" class="dc-file" accept=".csv,.tsv,.xlsx,.xls,.json" hidden><button class="btn btn-ghost" data-action="json">保存当前图表 JSON</button><button class="btn btn-ghost" data-action="csv">导出 CSV</button><button class="btn btn-ghost" data-action="xlsx">导出 Excel</button></div><span class="dc-note">所有数据仅在当前浏览器处理</span></div>
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
    $('[data-chart-select]').addEventListener('change',event=>switchChart(event.target.value));
    observer=new ResizeObserver(()=>{if(!host.isConnected){observer.disconnect();chart.dispose();return;}resize();});
    observer.observe($('.dc-preview-stage'));updateAll();
  }
  function tableUI() {
    $('.dc-table-wrap').innerHTML=`<table class="dc-table"><thead><tr><th>#</th>${project.table[0].map((v,c)=>`<th><div class="dc-cell-head"><input aria-label="第 ${c+1} 列名称" data-row="0" data-col="${c}" value="${esc(v)}">${c?`<button class="dc-remove" title="删除此数值列" aria-label="删除第 ${c+1} 列" data-delete-col="${c}">×</button>`:''}</div></th>`).join('')}<th></th></tr></thead><tbody>${project.table.slice(1).map((row,i)=>`<tr><td>${i+1}</td>${row.map((v,c)=>`<td><input aria-label="第 ${i+1} 行第 ${c+1} 列" data-row="${i+1}" data-col="${c}" value="${esc(v)}" ${c?'inputmode="decimal"':''}></td>`).join('')}<td><button class="dc-remove" aria-label="删除第 ${i+1} 行" data-delete-row="${i+1}">×</button></td></tr>`).join('')}</tbody></table>`;
  }
  function updateAll() {
    chartList();
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
    else if(el.dataset.setting) {remember();const key=el.dataset.setting;project.settings[key]=el.type==='checkbox'?el.checked:el.type==='number'&&el.value!==''?Number(el.value):el.value;if(key==='title')chartList();preview();}
    else if(el.dataset.color!==undefined) {remember();project.settings.colors[Number(el.dataset.color)]=el.value;preview();}
  }
  function download(data,extension,mime) {
    const blob=data instanceof Blob?data:new Blob([data],{type:mime}); const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=(project.settings.title||'数据图表').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)+'.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function exportImage(format) {
    const p=C.normalizeProject(project), exportHost=host, exportChartId=collection.activeId, token=window.ElUtil.editSession();let temporary;
    const box=document.createElement('div');box.style.cssText=`position:fixed;left:-10000px;top:0;width:${p.settings.width}px;height:${p.settings.height}px;`;document.body.appendChild(box);
    try {
      temporary=window.echarts.init(box,null,{renderer:format==='svg'?'svg':'canvas',width:p.settings.width,height:p.settings.height});
      temporary.setOption({...C.buildOption(p),animation:false});
      if(format==='svg') download(temporary.renderToSVGString(),'svg','image/svg+xml;charset=utf-8');
      else {const data=temporary.getDataURL({type:'png',pixelRatio:2,backgroundColor:p.settings.background});const blob=await (await fetch(data)).blob();if(host!==exportHost||collection.activeId!==exportChartId||!window.ElUtil.editSessionCurrent(token))return;download(blob,'png','image/png');}
      status('已导出 '+format.toUpperCase()+' 图片');
    } finally {if(temporary)temporary.dispose();box.remove();}
  }
  async function onClick(event) {
    const button=event.target.closest('button');if(!button)return;
    try {
      if(button.dataset.type) {switchType(button.dataset.type);return;}
      if(button.dataset.deleteRow) {if(project.table.length<=2)throw new Error('至少保留一行数据');remember();project.table.splice(Number(button.dataset.deleteRow),1);tableUI();preview();notify();return;}
      if(button.dataset.deleteCol) {if(project.table[0].length<=2)throw new Error('至少保留一个数值列');remember();project.table.forEach(r=>r.splice(Number(button.dataset.deleteCol),1));tableUI();preview();notify();return;}
      const action=button.dataset.action;
      if(action==='new-chart'||action==='copy-chart') {
        if(collection.charts.length>=100)throw new Error('每个项目最多支持 100 张图表');
        captureCollection();
        const next=action==='copy-chart'?clone(project):C.defaults(project.type);
        next.settings.title=action==='copy-chart'?(project.settings.title||'未命名图表').slice(0,497)+' 副本':C.types.find(item=>item.id===project.type).name+' '+(chartsOfType().length+1);
        const id=crypto.randomUUID();collection.charts.push({id,chart:next});switchChart(id);return;
      }
      if(action==='delete-chart') {
        const items=chartsOfType();
        if(items.length===1)throw new Error('当前类型至少保留一张图表');
        if(!window.confirm(`删除图表“${project.settings.title||'未命名图表'}”？此操作不可撤销。`))return;
        const removed=collection.activeId,index=items.findIndex(item=>item.id===removed);
        switchChart(items[index===0?1:index-1].id);
        collection.charts=collection.charts.filter(item=>item.id!==removed);chartHistories.delete(removed);chartList();notify();return;
      }
      if(action==='all-json') {download(JSON.stringify(C.normalizeCollection(captureCollection(),{draft:true}),null,2),'json','application/json');status('已保存全部图表的数据与配置');}
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
      let next, importedCollection, sheetNote='';
      if(/\.json$/i.test(file.name)) {
        const raw=JSON.parse(await file.text());
        if(raw.schema===2)importedCollection=C.normalizeCollection(raw,{draft:true});
        else next=C.normalizeProject(raw);
      }
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
      if(importedCollection) {
        if(!window.confirm('导入全部图表将替换当前项目中的图表列表，是否继续？'))return;
        restoreCollection(importedCollection);
      } else if(next.type!==project.type) {
        if(collection.charts.length>=100)throw new Error('每个项目最多支持 100 张图表');
        captureCollection();const id=crypto.randomUUID();collection.charts.push({id,chart:next});switchChart(id);
      } else {remember();project=next;updateAll();}
      notify();if(valid)status(`已导入 ${file.name}${sheetNote}`);
    } catch(error) {if(host===currentHost)status('导入失败：'+error.message,true);}
    finally {event.target.value='';}
  }
  T.register({id:'data-charts',title:'数据图表',group:'数据与文档',desc:'21 种图表 · 表格在线编辑 · 数据导入导出 · 标题、图例、标签与坐标自定义',render,
    validateDraft(saved) {try{C.normalizeCollection(saved,{draft:true});return true;}catch{return false;}},
    captureDraft:captureCollection,
    restoreDraft(saved) {if(saved) {try{restoreCollection(saved);}catch(error){status('草稿无法恢复：'+error.message,true);}}},
    refreshDraft:()=>updateAll(),
    resetDraft() {restoreCollection(C.defaults());}
  });
})();
