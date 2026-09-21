/** Pure geometry. Contextual functions take the project as their first argument. */
(function(root,factory){
  const common=typeof module==='object'&&module.exports;
  const api=factory(common?require('./model.js'):root.ElectricalSchematic.model);
  if(common)module.exports=api;else root.ElectricalSchematic.geometry=api;
})(typeof globalThis==='object'?globalThis:this,function(M){
  'use strict';
  const {rotationValue,isRelayType,connectorIsPlaced,clamp,sheetSizes}=M;
  const PIN_GAP=30,CONNECTOR_GAP=40;
  function canvasDimensions(state){return sheetSizes[state?.meta?.sheetSize]||sheetSizes.A3;}
  function rotatePoint(point,cx,cy,angle){const a=rotationValue(angle);if(!a)return{...point};const dx=point.x-cx,dy=point.y-cy,q=a===90?{x:cx-dy,y:cy+dx}:a===180?{x:cx-dx,y:cy-dy}:{x:cx+dy,y:cy-dx},sides=['top','right','bottom','left'],at=sides.indexOf(point.side);return{...point,...q,side:at<0?point.side:sides[(at+a/90)%4]};}
  function sideSpan(c,side){const list=c.connectors.filter(k=>connectorIsPlaced(k)&&k.side===side);return list.reduce((sum,k)=>sum+Math.max(0,k.pins.length-1)*PIN_GAP,0)+Math.max(0,list.length-1)*CONNECTOR_GAP;}
  function componentMinimumSize(c,gridSize=10){if(c.type==='junction')return{w:20,h:20};if(c.type==='device'){const relay=isRelayType(c.symbolType),hasBottom=c.connectors.some(k=>connectorIsPlaced(k)&&k.side==='bottom'),minimum={w:relay?96:72,h:relay?(c.value?92:78):(c.value?(hasBottom?86:70):(hasBottom?70:58))};return rotationValue(c.rotation)%180?{w:minimum.h,h:minimum.w}:minimum;}const vertical=Math.max(sideSpan(c,'left'),sideSpan(c,'right')),horizontal=Math.max(sideSpan(c,'top'),sideSpan(c,'bottom')),deviceW=Math.max(0,...c.devices.map(d=>Number(d.x||0)+(rotationValue(d.rotation)%180?96:118))),deviceH=Math.max(0,...c.devices.map(d=>Number(d.y||0)+(rotationValue(d.rotation)%180?118:(isRelayType(d.type)?96:82)))),hasPins=c.connectors.some(k=>connectorIsPlaced(k)&&k.pins.length);return{w:Math.max(5*gridSize,horizontal?horizontal+40:0,deviceW+(c.devices.length?20:0),hasPins?40:0),h:Math.max(2*gridSize,vertical?vertical+50:0,deviceH+(c.devices.length?20:0),hasPins?40:0)};}
  function standaloneBaseComponent(c){if(rotationValue(c.rotation)%180===0)return c;const w=c.h,h=c.w;return{...c,x:c.x+(c.w-w)/2,y:c.y+(c.h-h)/2,w,h};}
  function adjustedPinPosition(q,c,p){q={...q};if(c.type==='device'||c.type==='junction')return q;const offset=Number(p.offset)||0;if(q.side==='left'||q.side==='right')q.y=clamp(q.y+offset,c.y+10,c.y+c.h-10);else q.x=clamp(q.x+offset,c.x+10,c.x+c.w-10);return q;}
  function embeddedDeviceFrame(c,d){const x=c.x+Number(d.x||0),y=c.y+Number(d.y||0),relay=isRelayType(d.type),h=d.type==='ground'?34:relay?58:48;return{x,y,w:96,h,cx:x+48,cy:y+h/2,relay};}
  function embeddedDevicePortPosition(c,d,i){const f=embeddedDeviceFrame(c,d);let q;if(d.type==='ground')q={x:f.x+48,y:f.y,side:'top'};else if(f.relay)q=i===0?{x:f.x,y:f.y+f.h*.27,side:'left'}:i===1?{x:f.x+96,y:f.y+f.h*.27,side:'right'}:i===2?{x:f.x+27,y:f.y+58,side:'bottom'}:{x:f.x+69,y:f.y+58,side:'bottom'};else q=i===0?{x:f.x,y:f.y+24,side:'left'}:{x:f.x+96,y:f.y+24,side:'right'};return rotatePoint(q,f.cx,f.cy,d.rotation);}
  function pointSegmentDistance(p,a,b){if(isHorizontal(a,b))return Math.abs(p.y-a.y)+(p.x<Math.min(a.x,b.x)?Math.min(a.x,b.x)-p.x:p.x>Math.max(a.x,b.x)?p.x-Math.max(a.x,b.x):0);return Math.abs(p.x-a.x)+(p.y<Math.min(a.y,b.y)?Math.min(a.y,b.y)-p.y:p.y>Math.max(a.y,b.y)?p.y-Math.max(a.y,b.y):0);}
  function overlaps(a,b,pad=5){return a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;}
  function isHorizontal(a,b){return a.y===b.y&&a.x!==b.x;}
  function gridStep(state){return Number(state?.meta?.gridSize)||10;}
  function snapCoordinate(state,value,bypass=false){const n=Number(value)||0;if(bypass||!state?.meta?.snapToGrid)return Math.round(n);const step=gridStep(state);return Math.round(n/step)*step;}
  function snapClamp(state,value,min,max,bypass=false){return clamp(snapCoordinate(state,value,bypass),min,max);}
  function standaloneGlyphBox(state,c){const hasBottom=c.connectors.some(k=>k.side==='bottom'),reserve=(c.value?31:18)+(hasBottom?16:0),x=snapCoordinate(state,c.x+6),y=snapCoordinate(state,c.symbolType==='ground'?c.y:c.y+3),right=snapCoordinate(state,c.x+c.w-6),bottom=snapCoordinate(state,c.y+c.h-reserve-2),w=Math.max(36,right-x),h=Math.max(34,bottom-y);return{x,y,w,h,bottom:y+h,contactY:y+h*.27,hasBottom};}
  function connectorPosition(state,c,k,p){
    if(c.type==='junction'){const pi=k.pins.indexOf(p),paired=k.pins.length===2;return{x:c.x,y:c.y+(paired?(pi===0?-4:4):0),side:'right',junction:true};}
    if(c.type==='device'){const base=standaloneBaseComponent(c),box=standaloneGlyphBox(state,base),pi=k.pins.indexOf(p),centerX=box.x+box.w/2,centerY=box.y+box.h/2;let q;if(c.symbolType==='ground')q={x:base.x+base.w/2,y:base.y,side:'top'};else if(isRelayType(c.symbolType)){if(k.side==='left')q={x:box.x,y:box.contactY,side:'left'};else if(k.side==='right')q={x:box.x+box.w,y:box.contactY,side:'right'};else if(k.side==='bottom'){const gap=Math.min(25,box.w*.22),x=box.x+box.w/2+(pi-(k.pins.length-1)/2)*gap*2;q={x,y:box.bottom,side:'bottom'};}}else if(k.side==='left'||k.side==='right')q={x:k.side==='left'?box.x:box.x+box.w,y:box.y+box.h/2,side:k.side};else{const gap=Math.min(24,box.w/3),x=box.x+box.w/2+(pi-(k.pins.length-1)/2)*gap;q={x,y:k.side==='top'?box.y:box.bottom,side:k.side};}const rotated=rotatePoint(q||{x:centerX,y:centerY,side:k.side},centerX,centerY,c.rotation);return{...rotated,x:snapCoordinate(state,rotated.x),y:snapCoordinate(state,rotated.y)};}
    const same=c.connectors.filter(x=>x.side===k.side),ki=same.indexOf(k),pi=k.pins.indexOf(p),span=sideSpan(c,k.side),before=same.slice(0,ki).reduce((sum,item)=>sum+Math.max(0,item.pins.length-1)*PIN_GAP+CONNECTOR_GAP,0);let q;if(k.side==='left'||k.side==='right'){const x=k.side==='left'?c.x:c.x+c.w,base=c.h<60?Math.max(10,(c.h-span)/2):40+Math.max(0,c.h-50-span)/2,y=snapCoordinate(state,c.y+base+before+pi*PIN_GAP);q={x,y,side:k.side};}else{const base=c.w<100?Math.max(10,(c.w-span)/2):20+Math.max(0,c.w-40-span)/2,x=snapCoordinate(state,c.x+base+before+pi*PIN_GAP),y=k.side==='top'?c.y:c.y+c.h;q={x,y,side:k.side};}return adjustedPinPosition(q,c,p);
  }
  function capturePinPositions(state,c){const positions=new Map;if(c.type==='device'||c.type==='junction')return positions;c.connectors.filter(connectorIsPlaced).forEach(k=>k.pins.forEach(p=>positions.set(p.id,connectorPosition(state,c,k,p))));return positions;}
  function endpointPositions(state){const map={};state.components.forEach(c=>{c.connectors.filter(connectorIsPlaced).forEach(k=>k.pins.forEach(p=>map[`pin:${p.id}`]=connectorPosition(state,c,k,p)));c.devices.forEach(d=>d.ports.forEach((_,i)=>map[`device:${d.id}:${i}`]=embeddedDevicePortPosition(c,d,i)));});return map;}
  function outward(state,p,d){if(p.side==='left')return{x:snapCoordinate(state,p.x-d),y:p.y};if(p.side==='right')return{x:snapCoordinate(state,p.x+d),y:p.y};if(p.side==='top')return{x:p.x,y:snapCoordinate(state,p.y-d)};return{x:p.x,y:snapCoordinate(state,p.y+d)};}
  function legendPosition(state){const {w:cw,h:ch}=canvasDimensions(state),fallback={x:cw-400,y:ch-205},x=state.meta.legendMoved&&Number.isFinite(Number(state.meta.legendX))?Number(state.meta.legendX):fallback.x,y=state.meta.legendMoved&&Number.isFinite(Number(state.meta.legendY))?Number(state.meta.legendY):fallback.y;return{x:clamp(x,12,cw-382),y:clamp(y,35,ch-112)};}
  function clampDrawingFrame(state,kind,rectangle){
    const paper=canvasDimensions(state),rows=Math.min(4,state.revisions?.length||0),minW=280,minH=kind==='title'?64:Math.max(54,18+rows*18);
    const w=clamp(Number(rectangle.w)||minW,minW,paper.w-24),h=clamp(Number(rectangle.h)||minH,minH,paper.h-24);
    return{x:clamp(Number(rectangle.x)||0,12,paper.w-w-12),y:clamp(Number(rectangle.y)||0,12,paper.h-h-12),w,h};
  }
  function drawingFrame(state,kind){
    const paper=canvasDimensions(state),rows=Math.min(4,state.revisions?.length||0),defaults=kind==='title'?{x:paper.w-360,y:paper.h-82,w:342,h:64}:{x:paper.w-360,y:24,w:342,h:Math.max(54,18+rows*18)},prefix=kind==='title'?'titleBlock':'revisionBlock',saved={};
    for(const field of ['x','y','w','h']){const value=state.meta?.[prefix+field.toUpperCase()];if(Number.isFinite(value))saved[field]=value;}
    return clampDrawingFrame(state,kind,{...defaults,...saved});
  }
  function sizeProject(state){state=M.clone(state);let requiredW=0,requiredH=0;state.components.forEach(c=>{const minimum=componentMinimumSize(c,gridStep(state));c.w=Math.max(Number(c.w)||0,minimum.w);c.h=Math.max(Number(c.h)||0,minimum.h);requiredW=Math.max(requiredW,c.x+c.w+20);requiredH=Math.max(requiredH,c.y+c.h+100);});const order=['A3','A2','A1','A0'];let index=Math.max(0,order.indexOf(state.meta.sheetSize));while(index<order.length-1&&(requiredW>sheetSizes[order[index]].w||requiredH>sheetSizes[order[index]].h))index++;state.meta.sheetSize=order[index];return state;}
  function stabilizePins(state,c,before,newPins=[]){
    if(c.type==='device'||c.type==='junction')return;
    newPins=newPins.filter(p=>c.connectors.some(k=>connectorIsPlaced(k)&&k.pins.includes(p)));const minimum=componentMinimumSize(c,gridStep(state));c.w=Math.max(Number(c.w)||0,minimum.w);c.h=Math.max(Number(c.h)||0,minimum.h);
    const restore=()=>c.connectors.forEach(k=>k.pins.forEach(p=>{const old=before.get(p.id);if(!old)return;const q=connectorPosition(state,c,k,p),delta=k.side==='left'||k.side==='right'?old.y-q.y:old.x-q.x;p.offset=(Number(p.offset)||0)+delta;}));
    restore();const fresh=new Set(newPins.map(p=>p.id));
    newPins.forEach(p=>{const k=c.connectors.find(item=>item.pins.includes(p));if(!k)return;const vertical=k.side==='left'||k.side==='right';
      const freePositions=()=>{const min=(vertical?c.y:c.x)+10,max=(vertical?c.y+c.h:c.x+c.w)-10,used=c.connectors.filter(item=>connectorIsPlaced(item)&&item.side===k.side).flatMap(item=>item.pins.map(pinItem=>({connector:item,pinItem}))).filter(item=>item.pinItem!==p&&!fresh.has(item.pinItem.id)).map(item=>{const q=connectorPosition(state,c,item.connector,item.pinItem);return vertical?q.y:q.x;}),positions=[];for(let value=snapCoordinate(state,min);value<=max;value+=gridStep(state))if(used.every(other=>Math.abs(value-other)>=PIN_GAP))positions.push(value);return positions;};
      let q=connectorPosition(state,c,k,p),current=vertical?q.y:q.x,candidates=freePositions();if(!candidates.length){if(vertical)c.h+=PIN_GAP;else c.w+=PIN_GAP;restore();q=connectorPosition(state,c,k,p);current=vertical?q.y:q.x;candidates=freePositions();}
      const chosen=candidates.sort((a,b)=>Math.abs(a-current)-Math.abs(b-current))[0]??current;p.offset=(Number(p.offset)||0)+(chosen-current);fresh.delete(p.id);
    });
  }
  // Work on a private component; the view applies dimensions and offsets in place.
  function stabilizePinsAfterChange(state,component,before,newPins=[]){const copy=M.clone(component),ids=new Set(newPins.map(p=>p.id)),pins=copy.connectors.flatMap(k=>k.pins).filter(p=>ids.has(p.id));stabilizePins(state,copy,before,pins);return copy;}
  return Object.freeze({sizeProject,stabilizePinsAfterChange,PIN_GAP,CONNECTOR_GAP,canvasDimensions,rotatePoint,sideSpan,componentMinimumSize,standaloneBaseComponent,adjustedPinPosition,embeddedDeviceFrame,embeddedDevicePortPosition,pointSegmentDistance,overlaps,isHorizontal,gridStep,snapCoordinate,snapClamp,standaloneGlyphBox,connectorPosition,capturePinPositions,endpointPositions,outward,legendPosition,drawingFrame,clampDrawingFrame});
});
