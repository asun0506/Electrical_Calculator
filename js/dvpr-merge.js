/** Consolidates DVP topics without discarding source requirements or distinct executions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.DVPRMerge = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const fields = ['testItem','standard','clause','sampleQty','preMeasure','environment','procedure','postMeasure','acceptance','sourceKey'];
  const text = v => String(v ?? '').trim();
  const clean = v => text(v).normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const clone = v => JSON.parse(JSON.stringify(v));
  const rules = [
    ['外观、标识与尺寸', /^(?:外观(?:检查|检测|要求)?|目视检查|尺寸(?:检测|测量|检验|要求|及公差)?|全尺寸|外观[、，,/及与]*标识[、，,/及与]*尺寸)$/],
    ['盐雾耐腐蚀', /盐雾|(?:汇流排界面腐蚀风险|涂层耐腐蚀与功能保持|泄压阀腐蚀后功能|型材表面与连接腐蚀)/],
    ['绝缘电阻', /^(?:绝缘电阻(?:测试|要求)?|绝缘要求|绝缘(?:测试|性能))$/],
    ['耐电压', /^(?:耐电压(?:测试|要求)?|耐压(?:测试|性能|要求)?|介电强度)$/],
    ['载流温升', /^(?:(?:FPC|PCB|导体|触点|额定电流|回路|FPC回路)?(?:载流)?温升(?:试验|测试|[\/与]降额)?|(?:FPC|PCB)?导体载流与(?:温升|热点)|触点压降与温升)$/i],
    ['温度循环', /^(?:温度循环(?:耐受|耐久)?(?:测试|试验)?|温度交变|耐温度变化性能|高低温循环|冷热循环要求)$/],
    ['温度冲击', /^(?:温度冲击|热冲击|冷热冲击)(?:试验|实验|测试)?$/],
    ['稳态湿热', /^(?:湿热|稳态湿热|恒定湿热(?:耐久要求)?|高温高湿|双85(?:测试|老化)?)(?:测试|试验)?$/],
    ['机械振动', /^(?:机械)?振动(?:测试|试验)?$/],
    ['机械冲击', /^(?:机械)?冲击(?:测试|试验)?$/],
    ['低温存储', /^(?:低温存储)(?:要求|试验|测试)?$/],
    ['高温存储', /^(?:高温存储)(?:要求|试验|测试)?$/],
    ['高低温存储', /^(?:高低温存储)(?:要求|试验|测试)?$/],
    ['禁限用物质', /^(?:禁用物(?:质)?|禁限用物质(?:要求|测试)?|ELV测试|RoHS[，,、]ELV禁用物质要求|ELV[、,]RoHS[、,]REACH禁用物质要求|材料与法规符合性)$/i],
    ['可焊性', /^可焊性(?:要求|测试)?$/],
    ['弯折能力', /^(?:(?:FPC)?弯折与铜箔应变|弯曲性要求)$/],
    ['动态弯折寿命', /^动态弯折寿命$/],
    ['窄带辐射抗扰', /^(?:窄带辐射EMC抗扰|传感器窄带辐射抗扰)$/i],
    ['扭矩—夹紧力', /^(?:扭矩[—\-/]?夹紧力(?:试验)?|扭矩夹紧力窗口与松弛)$/],
    ['液路颗粒清洁度', /^(?:流道清洁度|液冷回路颗粒清洁度|系统清洁度(?:测试)?)$/],
  ];
  function topic(row) {
    const original = text(row.testItem).normalize('NFKC');
    const name = original.replace(/^[A-Za-z\s,()-]+(?=[\u3400-\u9fff])/, '').replace(/\s+/g,'');
    // Explicit sample state, cycle variant and lifecycle qualifiers stay separate.
    const qualifier = [...new Set((name.match(/单件|总成|整车工况|换电站工况|老化后|试验后|受压状态|极限浮动|有\/无前置|[12]$/g)||[]))].join('/');
    const stripped = name.replace(/[（(].*?[）)]/g,'');
    const match = rules.find(([,pattern]) => pattern.test(stripped));
    const label = match ? match[0] : original;
    return { key:clean(label)+(qualifier?`|${qualifier}`:''), label:match?label+(qualifier?`（${qualifier}）`:''):original };
  }
  function sources(row) {
    if(Array.isArray(row.mergeSources) && row.mergeSources.length) {
      const list=row.mergeSources.map(s=>({...Object.fromEntries(fields.map(k=>[k,text(s[k])])),manualOverride:s.manualOverride===true}));
      // Source snapshots trace original requirements, but edited workspace text is authoritative.
      for(const key of ['clause','sampleQty','preMeasure','environment','procedure','postMeasure','acceptance']) {
        if(text(row[key])!==text(combineField(list,key))){list.forEach(s=>{s.manualOverride=true;s[key]='';});list[0][key]=text(row[key]);}
      }
      if(text(row.standard)!==[...new Set(list.map(s=>s.standard).filter(Boolean))].join('\n'))list.forEach(s=>{s.standard=text(row.standard);s.manualOverride=true;});
      if(text(row.testItem)!==topic({testItem:list[0].testItem}).label)list.forEach(s=>{s.testItem=text(row.testItem);s.manualOverride=true;});
      return list;
    }
    return [{...Object.fromEntries(fields.map(k=>[k,text(row[k])])),manualOverride:false}];
  }
  function sourceSignature(s) { return JSON.stringify(fields.filter(k=>k!=='sourceKey').map(k=>clean(s[k]))); }
  function conditions(s) {
    const value = `${s.environment} ${s.procedure}`.normalize('NFKC');
    const result = {};
    const units = {mA:['current',.001],A:['current',1],kV:['voltage',1000],V:['voltage',1],ms:['time',.001],s:['time',1],min:['time',60],h:['time',3600],Hz:['frequency',1],kHz:['frequency',1000],mm:['length',1],kPa:['pressure',1],MPa:['pressure',1000],'℃':['temperature',1],'°C':['temperature',1],'度':['temperature',1],'%':['humidity',1]};
    for(const m of value.matchAll(/(-?\d+(?:\.\d+)?)\s*(mA|kV|kHz|MPa|kPa|ms|min|mm|Hz|A|V|s|h|℃|°C|度|%)(?![A-Za-z])/g)) {
      const [key,scale]=units[m[2]],n=Number(m[1])*scale;
      (result[key]||(result[key]=new Set())).add(n);
    }
    for(const m of value.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:±|\+\s*-|\+\s*\/\s*-)\s*(\d+(?:\.\d+)?)\s*(mA|kV|kHz|MPa|kPa|ms|min|mm|Hz|A|V|s|h|℃|°C|度|%)(?![A-Za-z])/g)) {
      const [key,scale]=units[m[3]];
      (result[key]||(result[key]=new Set())).add(`${Number(m[1])*scale}±${Number(m[2])*scale}`);
    }
    for(const family of ['NSS','AASS','CASS','AC','DC'])if(new RegExp(`\\b${family}\\b`,'i').test(value))(result.method||(result.method=new Set())).add(family);
    return result;
  }
  function compatible(a,b) {
    if(a.productId !== b.productId || clean(a.productName) !== clean(b.productName))return false;
    if(!a.productId && !text(a.productName))return false;
    if(topic(a).key!==topic(b).key)return false;
    if((a.status||'未开始')!==(b.status||'未开始'))return false;
    for(const key of ['owner','planStart','planEnd','reportNo'])if(text(a[key])&&text(b[key])&&text(a[key])!==text(b[key]))return false;
    for(const sa of sources(a))for(const sb of sources(b)) {
      const x=conditions(sa),y=conditions(sb);
      for(const key of Object.keys(x))if(y[key]) {
        const same=[...x[key]].every(v=>y[key].has(v))&&[...y[key]].every(v=>x[key].has(v));
        if(!same)return false;
      }
    }
    return true;
  }
  function combineField(list,key) {
    const entries=[];
    list.forEach(s=>{if(text(s[key])&&!entries.some(e=>clean(e.value)===clean(s[key])))entries.push({value:s[key],label:`${s.standard}｜${s.testItem}`});});
    if(entries.length<=1)return entries[0]?.value||'';
    return entries.map(e=>`[${e.label}] ${e.value}`).join(key==='sampleQty'?'；':'\n\n');
  }
  function combine(a,b) {
    const merged={...a},list=[],seen=new Set();
    for(const s of [...sources(a),...sources(b)]) {
      const key=sourceSignature(s),sameSource=s.sourceKey?list.findIndex(old=>old.sourceKey===s.sourceKey):-1;
      if(sameSource>=0&&list[sameSource].manualOverride&&!s.manualOverride)continue;
      if(sameSource>=0&&s.manualOverride&&!list[sameSource].manualOverride){list[sameSource]=s;seen.add(key);continue;}
      if(!seen.has(key)){seen.add(key);list.push(s);}
    }
    merged.mergeSources=list;
    merged.testItem=topic(a).label;
    merged.standard=[...new Set(list.map(s=>s.standard).filter(Boolean))].join('\n');
    for(const key of ['clause','sampleQty','preMeasure','environment','procedure','postMeasure','acceptance'])merged[key]=combineField(list,key);
    for(const key of ['owner','planStart','planEnd','reportNo'])if(!text(merged[key]))merged[key]=b[key]||'';
    merged.attachments=[...a.attachments||[]];
    for(const f of b.attachments||[])if(!merged.attachments.some(e=>e.name===f.name&&e.dataUrl===f.dataUrl))merged.attachments.push(clone(f));
    return merged;
  }
  function mergeRows(input) {
    const rows=[];
    for(const row of input){const next=clone(row),index=rows.findIndex(existing=>compatible(existing,next));if(index<0)rows.push(next);else rows[index]=combine(rows[index],next);}
    return { rows, mergedCount:input.length-rows.length };
  }
  return Object.freeze({ mergeRows, topic });
});
