/* Shared spreadsheet-style navigation for native input/textarea grids. */
(function(root){
  'use strict';
  function nextCell(row,col,rows,cols,key,shift=false){
    if(key==='Tab'){
      const index=row*cols+col+(shift?-1:1);
      return index<0||index>=rows*cols?null:[Math.floor(index/cols),index%cols];
    }
    const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[key];
    return delta?[Math.max(0,Math.min(rows-1,row+delta[0])),Math.max(0,Math.min(cols-1,col+delta[1]))]:null;
  }
  function bind(host,selector){
    host.addEventListener('keydown',event=>{
      const input=event.target;if(!input.matches(selector)||event.isComposing||event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.key==='F2'){event.preventDefault();input.dataset.gridTextEditing=input.dataset.gridTextEditing?'':'true';return;}
      if(event.key==='Escape'){delete input.dataset.gridTextEditing;return;}
      if((input.dataset.gridTextEditing||event.shiftKey)&&event.key!=='Tab')return;
      const controls=Array.from(host.querySelectorAll(selector));
      const rows=Math.max(...controls.map(el=>Number(el.dataset.row)))+1,cols=Math.max(...controls.map(el=>Number(el.dataset.col)))+1;
      const target=nextCell(Number(input.dataset.row),Number(input.dataset.col),rows,cols,event.key,event.shiftKey);
      if(!target)return;
      const next=controls.find(el=>Number(el.dataset.row)===target[0]&&Number(el.dataset.col)===target[1]);
      if(!next)return;
      event.preventDefault();delete input.dataset.gridTextEditing;next.focus();next.select();next.scrollIntoView({block:'nearest',inline:'nearest'});
    });
  }
  const api={nextCell,bind};if(typeof module==='object'&&module.exports)module.exports=api;else root.GridEditing=api;
})(typeof window==='undefined'?globalThis:window);
