(function(){
  'use strict';
  const C=window.TableToolsCore,esc=C.escape;
  let state=C.defaults(),host=null,selected=[0,0],revision=0;
  const history=[],future=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const $=selector=>host.querySelector(selector);
  const field=(key,label,type='text',attrs='')=>`<label class="tt-field">${label}<input data-tt-setting="${key}" type="${type}" ${attrs}></label>`;
  const select=(key,label,values)=>`<label class="tt-field">${label}<select data-tt-setting="${key}">${values.map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></label>`;
  const check=(key,label)=>`<label class="tt-check"><input type="checkbox" data-tt-setting="${key}">${label}</label>`;
  const section=(title,body,open=false)=>`<details ${open?'open':''}><summary>${title}</summary><div class="tt-fields">${body}</div></details>`;
  function message(text,error=false){$('.tt-status').textContent=text;$('.tt-status').dataset.error=String(error);}
  function notify(){host.dispatchEvent(new Event('change',{bubbles:true}));}
  function remember(){history.push(clone(state));if(history.length>40)history.shift();future.length=0;revision++;}
  function render(element){
    host=element;state=C.defaults();selected=[0,0];history.length=0;future.length=0;revision++;
    host.innerHTML=`<div class="tt-tool">
      <section class="tt-panel"><div class="tt-heading"><h3>快速样式</h3><p class="tt-note">先选样式，再编辑内容；单独设置的单元格格式优先。</p></div><div class="tt-presets">${C.presets.map(p=>`<button type="button" class="tt-preset" data-tt-preset="${p.id}" aria-pressed="false"><span class="tt-mini">${Array.from({length:9},(_,i)=>`<i style="background:${i<3?p.headerFill:i<6?p.stripeFill:p.fill}"></i>`).join('')}</span>${p.name}</button>`).join('')}</div></section>
      <div class="tt-toolbar"><button class="btn btn-primary" data-tt-action="copy">复制表格到 PPT</button><button class="btn btn-ghost" data-tt-action="pptx">导出可编辑 PPTX</button><button class="btn btn-ghost" data-tt-action="html">导出带格式 HTML</button><button class="btn btn-ghost" data-tt-action="json">保存表格 JSON</button><button class="btn btn-ghost" data-tt-action="import">导入表格 JSON</button><input type="file" accept=".json" class="tt-file" hidden><button class="btn btn-ghost" data-tt-action="undo">撤销</button><button class="btn btn-ghost" data-tt-action="redo">重做</button></div>
      <p class="tt-note">复制后在 PowerPoint 中粘贴，选择“保留源格式”。也可打开导出的 PPTX，复制其中的原生表格继续编辑。长表导出时自动分页并重复表头。</p>
      <div class="tt-status" role="status" aria-live="polite"></div>
      <div class="tt-layout"><section class="tt-panel"><div class="tt-heading"><h3 class="tt-preview-title"></h3><span class="tt-note tt-size"></span></div><p class="tt-note">点击单元格输入文字；支持方向键、Tab / Shift+Tab 切换，F2 切换文字编辑模式。可直接粘贴 Excel 区域。</p><div class="tt-stage"><table class="tt-editor" aria-label="可编辑表格"></table></div></section>
      <aside class="tt-panel tt-settings"><h3>表格设置</h3><div>
      ${section('名称与尺寸',`<div class="tt-full">${field('title','表格名称')}</div><label class="tt-field">行数<input class="tt-rows" type="number" min="1" max="50" aria-label="表格行数"></label><label class="tt-field">列数<input class="tt-cols" type="number" min="1" max="20" aria-label="表格列数"></label><button class="btn btn-ghost tt-full" data-tt-action="resize">应用行列数</button>`+field('width','表格宽度 px','number','min="240" max="1800"')+field('rowHeight','最小行高 px','number','min="24" max="160"')+field('padding','内边距 px','number','min="0" max="30"'),true)}
      ${section('字体与对齐',select('fontFamily','字体',C.fonts.map(font=>[font,({'Microsoft YaHei':'微软雅黑','DengXian':'等线','SimSun':'宋体'})[font]||font]))+field('fontSize','字号 pt','number','min="8" max="48"')+select('align','水平对齐',[['left','左对齐'],['center','居中'],['right','右对齐']])+select('vertical','垂直对齐',[['top','顶部'],['middle','居中'],['bottom','底部']])+field('color','正文字体颜色','color')+check('bold','正文加粗')+check('firstColumn','首列加粗'),true)}
      ${section('边框与底纹',select('borderMode','边框范围',[['all','全部边框'],['outer','外边框'],['rows','水平线'],['none','无边框']])+select('borderDash','线型',[['solid','实线'],['dashed','虚线'],['dotted','点线']])+field('borderWidth','边框宽度 px','number','min="0" max="6" step="0.5"')+field('borderColor','边框颜色','color')+field('fill','正文底纹','color')+field('stripeFill','隔行底纹','color')+check('header','首行为表头')+check('stripes','启用隔行底纹')+field('headerFill','表头底纹','color')+field('headerColor','表头字体颜色','color'))}
      ${section('选中单元格',`<p class="tt-note tt-full tt-selection"></p><label class="tt-field">底纹<input type="color" data-tt-cell="fill" aria-label="选中单元格底纹"></label><label class="tt-field">字体颜色<input type="color" data-tt-cell="color" aria-label="选中单元格字体颜色"></label><label class="tt-field">水平对齐<select data-tt-cell="align"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label><label class="tt-check"><input type="checkbox" data-tt-cell="bold">加粗</label><button class="btn btn-ghost tt-full" data-tt-action="clear-cell">清除单元格专属格式</button>`)}
      </div></aside></div></div>`;
    host.addEventListener('input',onInput);
    host.addEventListener('focusin',event=>{if(event.target.matches('.tt-editor [data-row]')){selected=[Number(event.target.dataset.row),Number(event.target.dataset.col)];selectionUI();}});
    host.addEventListener('click',onClick);host.addEventListener('paste',onPaste);$('.tt-file').addEventListener('change',importFile);
    window.GridEditing.bind(host,'.tt-editor [data-row]');refresh();
  }
  function selectionUI(){
    $('.tt-selection').textContent=`第 ${selected[0]+1} 行，第 ${selected[1]+1} 列`;
    const style=C.cellStyle(state,...selected);
    host.querySelectorAll('[data-tt-cell]').forEach(input=>{const value=style[input.dataset.ttCell];if(input.type==='checkbox')input.checked=value;else input.value=value;});
    host.querySelectorAll('.tt-editor td').forEach(td=>td.classList.toggle('tt-selected',Number(td.dataset.r)===selected[0]&&Number(td.dataset.c)===selected[1]));
  }
  function fit(input){input.style.height='auto';input.style.height=input.scrollHeight+'px';}
  function paint(){
    const table=$('.tt-editor');table.style.width=state.width+'px';
    table.innerHTML=`<colgroup>${state.cells[0].map(()=>`<col style="width:${100/state.cells[0].length}%">`).join('')}</colgroup><tbody>${state.cells.map((row,r)=>`<tr>${row.map((value,c)=>`<td data-r="${r}" data-c="${c}" style="${C.css(state,r,c)}"><textarea rows="1" aria-label="第 ${r+1} 行第 ${c+1} 列" data-row="${r}" data-col="${c}" maxlength="2000">${esc(value)}</textarea></td>`).join('')}</tr>`).join('')}</tbody>`;
    table.querySelectorAll('textarea').forEach(fit);selectionUI();
    $('.tt-preview-title').textContent=state.title||'未命名表格';$('.tt-size').textContent=`${state.cells.length} 行 × ${state.cells[0].length} 列 · ${state.width} px`;
  }
  function actionsUI(){$('[data-tt-action=undo]').disabled=!history.length;$('[data-tt-action=redo]').disabled=!future.length;}
  function refresh(){
    host.querySelectorAll('[data-tt-setting]').forEach(input=>{const value=state[input.dataset.ttSetting];if(input.type==='checkbox')input.checked=value;else input.value=value;});
    $('.tt-rows').value=state.cells.length;$('.tt-cols').value=state.cells[0].length;
    host.querySelectorAll('[data-tt-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ttPreset===state.id)));
    selected=[Math.min(selected[0],state.cells.length-1),Math.min(selected[1],state.cells[0].length-1)];paint();actionsUI();
  }
  function onInput(event){
    const input=event.target;
    try{
      if(input.matches('.tt-editor [data-row]')){remember();state.cells[Number(input.dataset.row)][Number(input.dataset.col)]=input.value;fit(input);actionsUI();}
      else if(input.dataset.ttSetting){
        const key=input.dataset.ttSetting,value=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
        const next=C.normalize({...state,[key]:value});remember();state=next;paint();actionsUI();
      }else if(input.dataset.ttCell){
        const key=selected.join(':'),next=clone(state);next.overrides[key]={...next.overrides[key],[input.dataset.ttCell]:input.type==='checkbox'?input.checked:input.value};
        C.normalize(next);remember();state=next;paint();actionsUI();
      }else return;
      message('');
    }catch(error){message(error.message,true);}
  }
  function download(data,extension,mime,name=state.title){
    const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type:mime})),link=document.createElement('a');
    link.href=url;link.download=(name||'表格').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80)+'.'+extension;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  async function copy(){
    const html=C.toHTML(state),plain=state.cells.map(row=>row.join('\t')).join('\r\n');
    if(navigator.clipboard?.write&&window.ClipboardItem){try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);return;}catch{/* Fall through for local files and clipboard restrictions. */}}
    const copyEvent=event=>{event.preventDefault();event.clipboardData.setData('text/html',html);event.clipboardData.setData('text/plain',plain);};
    const selection=window.getSelection(),ranges=Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange());
    const node=document.createElement('div');node.contentEditable='true';node.style.cssText='position:fixed;left:-10000px;top:0';node.innerHTML=html;document.body.appendChild(node);
    const range=document.createRange();range.selectNodeContents(node);selection.removeAllRanges();selection.addRange(range);document.addEventListener('copy',copyEvent);
    try{if(!document.execCommand('copy'))throw new Error('浏览器未允许复制，请使用“导出可编辑 PPTX”');}
    finally{document.removeEventListener('copy',copyEvent);node.remove();selection.removeAllRanges();ranges.forEach(saved=>selection.addRange(saved));}
  }
  async function onClick(event){
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.dataset.ttPreset){remember();state={...state,...clone(C.presets.find(p=>p.id===button.dataset.ttPreset))};refresh();notify();return;}
      const action=button.dataset.ttAction;
      if(action==='resize'){
        const rows=Number($('.tt-rows').value),cols=Number($('.tt-cols').value),next=C.resize(state,rows,cols);
        if(state.cells.some((row,r)=>row.some((value,c)=>(r>=rows||c>=cols)&&value.trim()))&&!confirm('缩小表格将移除超出范围的内容，是否继续？可通过撤销恢复。'))return;
        remember();state=next;refresh();notify();
      }
      if(action==='clear-cell'){remember();delete state.overrides[selected.join(':')];refresh();notify();}
      if(action==='undo'&&history.length){future.push(clone(state));state=history.pop();revision++;refresh();notify();}
      if(action==='redo'&&future.length){history.push(clone(state));state=future.pop();revision++;refresh();notify();}
      if(action==='copy'){const currentHost=host;await copy();if(currentHost===host&&host.isConnected)message('已复制表格内容与格式，请在 PPT 中粘贴并选择“保留源格式”。');}
      if(action==='html'){download('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(state.title)+'</title></head><body>'+C.toHTML(state)+'</body></html>','html','text/html;charset=utf-8');message('已导出带格式 HTML 表格');}
      if(action==='json'){download(JSON.stringify(C.normalize(state),null,2),'json','application/json');message('已保存表格内容与样式');}
      if(action==='import')$('.tt-file').click();
      if(action==='pptx'){
        const snapshot=clone(state),currentHost=host,token=window.ElUtil.editSession(),files=C.pptxFiles(snapshot),zip=new JSZip();
        Object.entries(files).forEach(([path,xml])=>zip.file(path,xml));
        const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
        if(host!==currentHost||!window.ElUtil.editSessionCurrent(token))return;
        download(bytes,'pptx','application/vnd.openxmlformats-officedocument.presentationml.presentation',snapshot.title);message('已导出原生可编辑表格，打开 PPTX 后可继续修改或复制到其他演示文稿。');
      }
    }catch(error){message(error.message,true);}
  }
  function onPaste(event){
    const input=event.target;if(!input.matches('.tt-editor [data-row]'))return;
    const text=event.clipboardData.getData('text/plain');if(!/[\t\r\n]/.test(text))return;event.preventDefault();
    try{
      const pasted=window.DataChartsCore.parseDelimited(text,'\t'),r0=Number(input.dataset.row),c0=Number(input.dataset.col),rows=Math.max(state.cells.length,r0+pasted.length),cols=Math.max(state.cells[0].length,c0+Math.max(...pasted.map(row=>row.length)));
      const next=C.resize(state,rows,cols);pasted.forEach((row,r)=>row.forEach((value,c)=>next.cells[r+r0][c+c0]=value));C.normalize(next);remember();state=next;refresh();notify();message('已粘贴表格数据');
    }catch(error){message(error.message,true);}
  }
  async function importFile(event){
    const file=event.target.files[0];if(!file)return;const currentHost=host,currentRevision=revision;
    try{
      if(file.size>5*1024*1024)throw new Error('文件不能超过 5 MB');
      const next=C.normalize(JSON.parse(await file.text()));
      if(host!==currentHost||!host.isConnected)return;if(revision!==currentRevision)throw new Error('读取期间编辑内容已变化，请重新导入');
      remember();state=next;refresh();notify();message('已恢复表格内容与样式');
    }catch(error){if(host===currentHost)message('导入失败：'+error.message,true);}finally{event.target.value='';}
  }
  window.ElectricalToolkit.register({id:'table-tools',title:'表格工具',group:'工程文档',desc:'快速制作表格 · 边框、底纹与字体 · 带格式复制和可编辑 PowerPoint 导出',render,
    validateDraft(saved){try{C.normalize(saved);return true;}catch{return false;}},captureDraft:()=>clone(state),
    restoreDraft(saved){state=C.normalize(saved);history.length=0;future.length=0;selected=[0,0];revision++;refresh();},refreshDraft:refresh,
    resetDraft(){state=C.defaults();history.length=0;future.length=0;selected=[0,0];revision++;refresh();}
  });
})();
