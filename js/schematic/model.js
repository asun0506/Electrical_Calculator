/**
 * Schematic data factories, usable as classic scripts or CommonJS.
 * normalize(value, context) and createX(context, ...args) receive an ID source,
 * a clock returning a Date, and optional grid metadata: { id, clock, meta }.
 * The caller owns ID sequencing. No ambient clock or project state is read.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else (root.ElectricalSchematic||(root.ElectricalSchematic={})).model=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const sheetSizes={A3:{w:1400,h:900,mmW:420,mmH:297},A2:{w:1980,h:1273,mmW:594,mmH:420},A1:{w:2800,h:1800,mmW:841,mmH:594},A0:{w:3960,h:2546,mmW:1189,mmH:841}};
  const lineTypes={
    hv:{name:'高压线路',color:'#f5a400',width:3.4},
    'hv-sense':{name:'高压采样线路',color:'#f5a400',width:1.35},
    lv:{name:'低压线路',color:'#111827',width:1.45},
    can:{name:'Twisted_Pair',color:'#5b942b',pairColor:'#b97718',width:1.35,twisted:true},
    hvil:{name:'HVIL线路',color:'#49bcd6',width:1.65},
    power12:{name:'12V电源',color:'#e53935',width:1.45},
    ground:{name:'低压地',color:'#111827',width:1.45},
  };
  const deviceTypes={relay:'Relay',contactor:'Contactor',switch:'Switch',breaker:'Circuit Breaker',fuse:'Thermal Fuse',pyro:'Pyro-fuse',resistor:'Resistor',thermistor:'Thermistor',capacitor:'Capacitor',inductor:'Inductor',diode:'Diode',led:'LED',mosfet:'MOSFET',shunt:'Shunt',hall:'Hall Sensor',current:'Current Sensor',voltage:'Voltage Sensor',temperature:'Temperature Sensor',battery:'Battery',motor:'Motor',connector:'Connector',ground:'Ground',terminal:'Terminal'};
  const legacyDeviceNames={继电器:'Relay',主继电器:'Main Relay',内嵌继电器:'Embedded Relay',独立继电器:'Standalone Relay',接触器:'Contactor',开关:'Switch',断路器:'Circuit Breaker',热熔保险丝:'Thermal Fuse',主保险丝:'Main Fuse',电阻:'Resistor',预充电阻:'Pre-charge Resistor',热敏电阻:'Thermistor',电容:'Capacitor',电感:'Inductor',二极管:'Diode','Shunt电流传感器':'Shunt','Hall霍尔传感器':'Hall Sensor',电流传感器:'Current Sensor',电压传感器:'Voltage Sensor',温度传感器:'Temperature Sensor',电池:'Battery',电机:'Motor',连接器:'Connector',接地:'Ground',线端:'Terminal'};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const rotationValue=value=>((Math.round((Number(value)||0)/90)*90)%360+360)%360;
  const colorValue=(value,fallback='')=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value).toLowerCase():fallback;
  const isRelayType=type=>type==='relay'||type==='contactor';
  const devicePorts=type=>type==='ground'?['GND']:isRelayType(type)?['1','2','A1','A2']:['1','2'];
  const connectorIsPlaced=k=>k?.placed!==false&&['left','right','top','bottom'].includes(k?.side);
  // Only this explicitly created ID source has local sequence state. Core factories
  // receive it from their caller; no module-level clock or counter is read.
  function createIdGenerator(clock) { let sequence=0; return prefix=>`${prefix}_${clock().getTime()}_${++sequence}`; }
  function create(context) {
    const uid=context.id, today=()=>context.clock().toISOString().slice(0,10);
    const snapCoordinate=value=>{const n=Number(value)||0,meta=context.meta;if(!meta?.snapToGrid)return Math.round(n);const step=Number(meta.gridSize)||10;return Math.round(n/step)*step;};
  function pin(no,definition='',fn=''){return{id:uid('pin'),no:String(no),definition,function:fn,offset:0};}
  function connector(name='连接器',side='right',defs=['Pin 1','Pin 2'],placed=true){return{id:uid('conn'),name,side,placed,pins:defs.map((d,i)=>pin(i+1,d))};}
  function device(type='relay',name='Device',x=40,y=70){return{id:uid('dev'),type,name,x,y,value:'',ports:devicePorts(type)};}
  function component(name='新部件',type='component',x=120,y=120,w=300,h=220){return{id:uid('cmp'),name,type,x,y,w,h,connectors:[],devices:[]};}
  function standaloneConnectors(symbolType){if(symbolType==='ground')return[{id:uid('conn'),name:'接地端',side:'top',pins:[pin(1,'GND','接地')]}];if(symbolType==='relay'||symbolType==='contactor')return[{id:uid('conn'),name:'主触点输入',side:'left',pins:[pin(1,'1','主触点输入')]},{id:uid('conn'),name:'主触点输出',side:'right',pins:[pin(2,'2','主触点输出')]},{id:uid('conn'),name:'线圈',side:'bottom',pins:[pin('A1','A1','线圈端子'),pin('A2','A2','线圈端子')]}];return[{id:uid('conn'),name:'输入端',side:'left',pins:[pin(1,'IN')]},{id:uid('conn'),name:'输出端',side:'right',pins:[pin(2,'OUT')]}];}
  function standaloneDevice(symbolType='relay',x=420,y=260){const relay=symbolType==='relay'||symbolType==='contactor',c=component(deviceTypes[symbolType]||'Device','device',x,y,relay?116:104,relay?92:76);c.symbolType=symbolType;c.value='';c.rotation=0;c.connectors=standaloneConnectors(symbolType);return c;}
  function junctionNode(x,y,paired=false){const c=component('','junction',snapCoordinate(x),snapCoordinate(y),20,20),pins=paired?[pin(1,'PAIR_1'),pin(2,'PAIR_2')]:[pin(1,'NODE')];if(paired)pins.forEach(p=>{p.twisted=true;p.pairGroup='1';});c.color='#546e7a';c.connectors=[{id:uid('conn'),name:'中间点',side:'right',pins}];c.open=true;return c;}
  function configureStandaloneSymbol(c,symbolType,previous){
    const oldPins=c.connectors?.flatMap(k=>k.pins||[])||[];c.symbolType=symbolType;
    if(symbolType==='ground'){const keep=oldPins[0],k={id:c.connectors?.[0]?.id||uid('conn'),name:'接地端',side:'top',pins:[keep||pin(1,'GND','接地')]};c.rotation=0;k.pins[0].no='1';k.pins[0].definition='GND';k.pins[0].function=k.pins[0].function||'接地';c.connectors=[k];return;}
    if(isRelayType(symbolType)){const next=standaloneConnectors(symbolType);if(oldPins[0])next[0].pins[0]=oldPins[0];if(oldPins[1])next[1].pins[0]=oldPins[1];if(oldPins[2])next[2].pins[0]=oldPins[2];if(oldPins[3])next[2].pins[1]=oldPins[3];next[0].pins[0].no='1';next[1].pins[0].no='2';next[2].pins[0].no='A1';next[2].pins[1].no='A2';c.connectors=next;return;}
    if(previous==='ground'||isRelayType(previous)||!c.connectors?.length){const next=standaloneConnectors(symbolType);oldPins.slice(0,2).forEach((p,i)=>next[i].pins[0]=p);c.connectors=next;}
  }
  function target(to){return{id:uid('target'),to,waypoints:[]};}
  function demo(){
    const edm={id:'cmp_edm',name:'EDM 电源分配单元',type:'component',x:190,y:90,w:430,h:250,connectors:[{id:'c_edm_hv',name:'HV接口',side:'right',pins:[{id:'p_edm_hvp',no:'1',definition:'HV+',function:'主回路正极'},{id:'p_edm_hvn',no:'2',definition:'HV-',function:'主回路负极'}]},{id:'c_edm_lv',name:'控制接口',side:'bottom',pins:[{id:'p_edm_pre',no:'1',definition:'PRECHARGE_CMD',function:'预充控制'},{id:'p_edm_hvil',no:'2',definition:'HVIL_OUT',function:'高压互锁'}]}],devices:[{id:'d_mainrelay',type:'relay',name:'Main Relay',x:45,y:75,value:'MC+',ports:['1','2','A1','A2']},{id:'d_fuse',type:'fuse',name:'Main Fuse',x:175,y:75,value:'F1',ports:['1','2']},{id:'d_pre',type:'resistor',name:'Pre-charge Resistor',x:300,y:75,value:'Rpre',ports:['1','2']}]};
    const bmu={id:'cmp_bmu',name:'BMU 电池管理单元',type:'component',x:270,y:430,w:500,h:250,connectors:[{id:'c_bmu_io',name:'P1 低压接口',side:'right',pins:[{id:'p_bmu_canh',no:'1',definition:'CAN_H',function:'整车CAN',twisted:true,pairGroup:'1'},{id:'p_bmu_canl',no:'2',definition:'CAN_L',function:'整车CAN',twisted:true,pairGroup:'1'},{id:'p_bmu_kl30',no:'3',definition:'KL30',function:'常电'},{id:'p_bmu_gnd',no:'4',definition:'KL31',function:'低压地'}]}],devices:[{id:'d_shunt',type:'shunt',name:'Shunt',x:55,y:80,value:'500A',ports:['1','2']},{id:'d_hall',type:'hall',name:'Hall',x:205,y:80,value:'I sense',ports:['1','2']},{id:'d_gnd',type:'ground',name:'Ground',x:380,y:110,value:'',ports:['GND']}]};
    const hv={id:'cmp_hvout',name:'高压输出连接器',type:'external-hv',x:1010,y:120,w:220,h:185,connectors:[{id:'c_hvout',name:'H1',side:'left',pins:[{id:'p_hvout_p',no:'1',definition:'HV+',function:'前驱高压正'},{id:'p_hvout_n',no:'2',definition:'HV-',function:'前驱高压负'},{id:'p_hvout_il',no:'3',definition:'HVIL',function:'互锁'}]}],devices:[]};
    const lv={id:'cmp_lvout',name:'ESS低压连接器',type:'external-lv',x:1010,y:500,w:220,h:190,connectors:[{id:'c_lvout',name:'K1',side:'left',pins:[{id:'p_lv_canh',no:'1',definition:'CAN_H',function:'整车CAN',twisted:true,pairGroup:'1'},{id:'p_lv_canl',no:'2',definition:'CAN_L',function:'整车CAN',twisted:true,pairGroup:'1'},{id:'p_lv_kl30',no:'3',definition:'KL30',function:'12V常电'},{id:'p_lv_gnd',no:'4',definition:'KL31',function:'低压地'}]}],devices:[]};
    return{schemaVersion:11,meta:{title:'电池包电气原理图',project:'示例电池包',drawingNo:'EE-SCH-001',version:'V0.6',author:'Yongshang',auditor:'',approver:'',date:today(),page:'1/1',sheetSize:'A3',canvasZoom:1,showGrid:true,snapToGrid:true,gridSize:10,legendX:null,legendY:null,legendMoved:false,connectionSort:'manual',notes:''},components:[edm,bmu,hv,lv],connections:[
      {id:'w1',from:'pin:p_edm_hvp',targets:[{id:'t1',to:'pin:p_hvout_p'}],type:'hv',gauge:'25 mm²',net:'HV+',function:'主高压输出'},
      {id:'w2',from:'pin:p_edm_hvn',targets:[{id:'t2',to:'pin:p_hvout_n'}],type:'hv',gauge:'25 mm²',net:'HV-',function:'主高压回路'},
      {id:'w3',from:'pin:p_edm_hvil',targets:[{id:'t3',to:'pin:p_hvout_il'}],type:'hvil',gauge:'0.22 mm²',net:'HVIL',function:'高压互锁'},
      {id:'w4',from:'pin:p_bmu_canh',pairFrom:'pin:p_bmu_canl',targets:[{id:'t4',to:'pin:p_lv_canh',pairTo:'pin:p_lv_canl'}],type:'can',gauge:'0.35 mm²',net:'CAN_H/L',function:'整车CAN通信'},
      {id:'w5',from:'pin:p_bmu_kl30',targets:[{id:'t5',to:'pin:p_lv_kl30'}],type:'power12',gauge:'0.5 mm²',net:'KL30',function:'12V常电'},
      {id:'w6',from:'pin:p_bmu_gnd',targets:[{id:'t6',to:'pin:p_lv_gnd'}],type:'ground',gauge:'0.5 mm²',net:'KL31',function:'低压地'},
    ],revisions:[{date:today(),version:'V0.6',description:'Compact four-terminal relays, visible grid and snap-aligned routing',owner:'Yongshang'}]};
  }
  function normalize(s){
    const d=demo();if(!s||!Array.isArray(s.components))return d;const meta={...d.meta,...(s.meta||{})};if(!sheetSizes[meta.sheetSize])meta.sheetSize='A3';meta.canvasZoom=clamp(Number(meta.canvasZoom)||1,.2,2);meta.showGrid=meta.showGrid!==false;meta.snapToGrid=meta.snapToGrid!==false;meta.gridSize=[5,10,20].includes(Number(meta.gridSize))?Number(meta.gridSize):10;meta.legendMoved=meta.legendMoved===true;meta.legendX=Number.isFinite(Number(meta.legendX))?Number(meta.legendX):null;meta.legendY=Number.isFinite(Number(meta.legendY))?Number(meta.legendY):null;meta.connectionSort=['manual','source','target'].includes(meta.connectionSort)?meta.connectionSort:'manual';
    const translatedName=(name,type)=>legacyDeviceNames[name]||name||deviceTypes[type]||'Device',aliases=new Map(),components=s.components.map(c=>({...c,id:c.id||uid('cmp'),name:c.type==='device'?translatedName(c.name,c.symbolType||'relay'):c.name,symbolType:c.type==='device'?(c.symbolType||'relay'):c.symbolType,value:c.value||'',rotation:c.type==='device'?rotationValue(c.rotation):0,color:colorValue(c.color),connectors:(c.connectors||[]).map(k=>({...k,id:k.id||uid('conn'),placed:k.placed!==false&&['left','right','top','bottom'].includes(k.side),pins:(k.pins||[]).map((p,i)=>({...p,id:p.id||uid('pin'),no:p.no??String(i+1),offset:Number(p.offset)||0,twisted:p.twisted===true,pairGroup:p.twisted===true?String(p.pairGroup||''):''}))})),devices:(c.devices||[]).map(x=>({...x,id:x.id||uid('dev'),name:translatedName(x.name,x.type),rotation:rotationValue(x.rotation),color:colorValue(x.color),ports:x.ports||['1','2']}))}));
    components.filter(c=>c.type==='device').forEach(c=>{const pins=c.connectors.flatMap(k=>k.pins||[]);if(Number(s.schemaVersion||0)<6&&Number(c.w)===150&&Number(c.h)===104){c.w=isRelayType(c.symbolType)?116:104;c.h=isRelayType(c.symbolType)?92:76;}if(c.symbolType==='ground'){const keep=pins[0];pins.slice(1).forEach(p=>aliases.set(`pin:${p.id}`,keep?`pin:${keep.id}`:''));configureStandaloneSymbol(c,'ground','ground');}else if(isRelayType(c.symbolType)&&pins.length<4)configureStandaloneSymbol(c,c.symbolType,'relay');});
    components.forEach(c=>c.devices.forEach(dv=>{dv.ports=Array.isArray(dv.ports)&&dv.ports.length>=devicePorts(dv.type).length?dv.ports:devicePorts(dv.type);if(dv.type==='ground')dv.rotation=0;}));
    const endpoint=key=>aliases.get(key)||key,connections=(s.connections||[]).map(w=>({...w,id:w.id||uid('wire'),type:w.type==='hv-drive'?'hv':(lineTypes[w.type]?w.type:'lv'),from:endpoint(w.from),pairFrom:endpoint(w.pairFrom),targets:Array.isArray(w.targets)&&w.targets.length?w.targets.map(t=>({...t,id:t.id||uid('target'),to:endpoint(t.to),pairTo:endpoint(t.pairTo),waypoints:Array.isArray(t.waypoints)?t.waypoints.map(p=>({x:Number(p.x)||0,y:Number(p.y)||0,...(p.free===true?{free:true}:{}),...(p.junctionId?{junctionId:String(p.junctionId)}:{})})):[]})):[target(endpoint(w.to))]}));
    if(Number(s.schemaVersion||0)<9){const junctionByPin=new Map;components.filter(c=>c.type==='junction').forEach(c=>c.connectors.forEach(k=>k.pins.forEach(p=>junctionByPin.set(`pin:${p.id}`,c))));const migrate=(owner,t,seen=new Set)=>{const junction=junctionByPin.get(t.to),child=junction&&connections.find(item=>item.id!==owner.id&&!item.parentWireId&&item.from===t.to);if(!junction||!child||seen.has(child.id)||!child.targets.length)return;seen.add(child.id);const primary=child.targets[0];if(!primary.to)return;migrate(child,primary,new Set(seen));const prefix=t.waypoints||[],suffix=primary.waypoints||[];t.to=primary.to;t.pairTo=primary.pairTo||'';t.waypoints=[...prefix,{x:junction.x,y:junction.y,junctionId:junction.id},...suffix];child.targets=child.targets.filter(item=>item!==primary);if(!child.targets.length){const blank=target('');if(child.type==='can')blank.pairTo='';child.targets=[blank];}child.parentWireId=owner.id;child.parentTargetId=t.id;child.parentJunctionId=junction.id;};connections.filter(w=>!junctionByPin.has(w.from)).forEach(w=>w.targets.forEach(t=>migrate(w,t)));}
    return{schemaVersion:11,meta,components,connections,revisions:Array.isArray(s.revisions)?s.revisions:[]};
  }
    return {defaultComponentColor,defaultDeviceColor,pin,connector,device,component,standaloneConnectors,standaloneDevice,junctionNode,configureStandaloneSymbol,target,demo,normalize};
  }
  function defaultComponentColor(c){if(c.type==='external-hv')return'#e5efc8';if(c.type==='external-lv')return'#fff0c8';if(c.type==='device')return isRelayType(c.symbolType)?(c.symbolType==='contactor'?'#e7f0f7':'#eef3df'):'#ffffff';return c.type==='container'?'#ffffff':'#eef3f7';}
  function defaultDeviceColor(type){return isRelayType(type)?(type==='contactor'?'#e7f0f7':'#eef3df'):'#ffffff';}
  const api={sheetSizes,lineTypes,deviceTypes,legacyDeviceNames,clone,clamp,rotationValue,colorValue,isRelayType,devicePorts,connectorIsPlaced,createIdGenerator,defaultComponentColor,defaultDeviceColor,
    normalize:(value,context)=>create(context).normalize(value),
    configureStandaloneSymbol:(value,type,previous,context)=>{const copy=clone(value);create(context).configureStandaloneSymbol(copy,type,previous);return copy;}
  };
  api.createPin=(context,...args)=>create(context).pin(...args);
  api.createConnector=(context,...args)=>create(context).connector(...args);
  api.createDevice=(context,...args)=>create(context).device(...args);
  api.createComponent=(context,...args)=>create(context).component(...args);
  api.standaloneConnectors=(context,...args)=>create(context).standaloneConnectors(...args);
  api.createStandaloneDevice=(context,...args)=>create(context).standaloneDevice(...args);
  api.createJunction=(context,...args)=>create(context).junctionNode(...args);
  api.createTarget=(context,...args)=>create(context).target(...args);
  api.createDemo=(context,...args)=>create(context).demo(...args);
  function freezeConstants(value){Object.values(value).forEach(item=>{if(item&&typeof item==='object')freezeConstants(item);});return Object.freeze(value);}
  [sheetSizes,lineTypes,deviceTypes,legacyDeviceNames].forEach(freezeConstants);
  return Object.freeze(api);
});
