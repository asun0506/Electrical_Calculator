/* Editable chart projects and pure data transformations. No DOM dependencies. */
(function (root) {
  'use strict';
  const types = [
    ['bar','柱状图'],['radar','雷达图'],['line','折线图'],['pie','饼图'],['rose','南丁格尔玫瑰图'],['candlestick','K线图'],
    ['river','河流图'],['donut','环形图'],['scatter','散点图'],['funnel','漏斗图'],['grouped-bar','分组柱状图'],['grouped-line','分组折线图'],
    ['waterfall','瀑布图'],['area','层叠面积图'],['horizontal-bar','条形柱状图'],['step','阶梯折线图'],['stacked-bar','堆叠柱状图'],
    ['negative-bar','正负条形图'],['stacked-horizontal','堆叠条形图'],['grouped-horizontal','分组条形图'],['stacked-area','堆叠面积图']
  ].map(([id, name]) => ({id, name}));
  const palette = ['#2589ef','#39ba9a','#ffc247','#9073df','#f27884','#35bdd2','#e59655','#76869c'];
  function defaults(type = 'bar') {
    let table = [['月份','实际值','目标值','参考值'],['一月',120,100,80],['二月',160,140,110],['三月',135,150,100],['四月',210,180,150],['五月',185,200,130],['六月',245,220,170]];
    if(type === 'candlestick') table = [['日期','开盘','收盘','最低','最高'],['2026-01-01',20,24,18,26],['2026-01-02',24,22,21,27],['2026-01-03',22,28,20,30],['2026-01-04',28,26,23,31]];
    if(type === 'scatter') table = [['X','实验组','对照组'],[1,12,8],[2,19,13],[3,16,18],[4,28,24],[5,32,26]];
    if(type === 'river') table = [['日期','产品甲','产品乙','产品丙'],['2026-01-01',12,8,15],['2026-01-02',18,10,12],['2026-01-03',13,19,17],['2026-01-04',22,14,20]];
    if(type === 'negative-bar' || type === 'waterfall') table = [['项目','变化量'],['初始',120],['采购',-35],['加工',-20],['回收',15],['新增',45]];
    return {schema:1, type, table, settings:{title:'数据图表',subtitle:'',titleAlign:'center',titleSize:22,legend:true,legendPosition:'bottom',labels:false,labelSize:12,labelFormat:'value',labelPosition:'top',xName:'',yName:'',yMin:'',yMax:'',xMin:'',xMax:'',axis:true,grid:true,rotate:0,smooth:false,animation:false,background:'#ffffff',textColor:'#475569',width:960,height:540,colors:palette.slice()}};
  }
  function parseDelimited(text, delimiter) {
    text = String(text).replace(/^\uFEFF/,'');
    if (!delimiter) {
      const first = text.split(/\r?\n/,1)[0];
      delimiter = first.includes('\t') ? '\t' : ',';
    }
    const rows = []; let row = [], cell = '', quoted = false;
    for(let i=0; i<text.length; i++) {
      const c=text[i];
      if(c==='"') {
        if(quoted && text[i+1]==='"') {cell+='"'; i++;}
        else if(quoted || cell==='') quoted=!quoted;
        else throw new Error('CSV 引号格式不正确');
      } else if(!quoted && c===delimiter) {row.push(cell);cell='';}
      else if(!quoted && (c==='\n'||c==='\r')) {
        if(c==='\r' && text[i+1]==='\n') i++;
        row.push(cell); rows.push(row); row=[];cell='';
      } else cell+=c;
    }
    if(quoted) throw new Error('CSV 引号未闭合');
    if(cell!=='' || row.length) {row.push(cell);rows.push(row);}
    while(rows.length && rows[rows.length-1].every(v=>v==='')) rows.pop();
    return rows;
  }
  function toCSV(table) {
    return '\uFEFF'+table.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  }
  function normalizeTable(table, numericFirst = false, draft = false) {
    if(!Array.isArray(table)||table.length<2||table.length>2001) throw new Error('需要表头及 1–2000 行数据');
    const count=Array.isArray(table[0])?table[0].length:0;
    if(count<2||count>21) throw new Error('需要分类列及 1–20 个数值列');
    return table.map((row,r)=>{
      if(!Array.isArray(row)||row.length!==count) throw new Error(`第 ${r+1} 行列数与表头不一致`);
      return row.map((v,c)=>{
        if(typeof v!=='string' && typeof v!=='number' && v!==null) throw new Error(`第 ${r+1} 行含无效单元格`);
        if(r===0 || (c===0&&!numericFirst)) {
          const s=String(v??''); if(s.length>500) throw new Error('单元格文字不能超过 500 字');
          if(r===0&&!s.trim()&&!draft) throw new Error('表头不能为空');
          return s;
        }
        if(v===null||String(v).trim()==='') return null;
        const n=Number(v);
        if(!Number.isFinite(n)) {
          if(draft&&typeof v==='string'&&v.length<=500)return v;
          throw new Error(`第 ${r+1} 行第 ${c+1} 列需要有限数值`);
        }
        return n;
      });
    });
  }
  function normalizeProject(raw, {draft = false} = {}) {
    if(!raw||raw.schema!==1) throw new Error('不支持的图表工程版本（需要 schema 1）');
    if(!types.some(t=>t.id===raw.type)) throw new Error('不支持的图表类型');
    const p=defaults(raw.type), s=raw.settings||{};
    for(const key of Object.keys(p.settings)) {
      if(s[key]===undefined) continue;
      if(key==='colors') {
        if(!Array.isArray(s.colors)||!s.colors.length||s.colors.length>20||s.colors.some(v=>!/^#[0-9a-f]{6}$/i.test(v))) throw new Error('配色需要十六进制颜色');
        p.settings.colors=s.colors.slice();
      } else if(['xMin','xMax','yMin','yMax'].includes(key)) {
        if(s[key]!=='' && !Number.isFinite(Number(s[key]))) throw new Error('坐标范围需要有限数值');
        p.settings[key]=s[key]===''?'':Number(s[key]);
      } else if(typeof p.settings[key]==='boolean') {
        if(typeof s[key]!=='boolean') throw new Error('开关配置无效');
        p.settings[key]=s[key];
      } else if(typeof p.settings[key]==='number') {
        const ranges={width:[320,2400],height:[240,1600],titleSize:[12,48],labelSize:[8,28],rotate:[-90,90]};
        const [lo,hi]=ranges[key]; const n=Number(s[key]);
        if(!Number.isFinite(n)||(!draft&&(n<lo||n>hi))) throw new Error(`${key} 需要在 ${lo}–${hi} 范围内`);
        p.settings[key]=n;
      } else {
        if(typeof s[key]!=='string'||s[key].length>500) throw new Error('文字配置无效');
        p.settings[key]=s[key];
      }
    }
    for(const key of ['background','textColor']) if(!/^#[0-9a-f]{6}$/i.test(p.settings[key])) throw new Error('颜色格式无效');
    const enums={titleAlign:['left','center','right'],legendPosition:['top','bottom','left','right'],labelFormat:['value','name','percent'],labelPosition:['top','inside','bottom']};
    for(const [k,values] of Object.entries(enums)) if(!values.includes(p.settings[k])) throw new Error('图表配置选项无效');
    for(const axis of ['x','y']) if(!draft&&p.settings[axis+'Min']!==''&&p.settings[axis+'Max']!==''&&p.settings[axis+'Min']>=p.settings[axis+'Max']) throw new Error('坐标最小值必须小于最大值');
    p.table=normalizeTable(raw.table, raw.type==='scatter',draft);
    return p;
  }
  function normalizeCollection(raw, options = {}) {
    if(raw?.schema===1) return {schema:2,activeId:'chart-1',activeByType:{[raw.type]:'chart-1'},charts:[{id:'chart-1',chart:normalizeProject(raw,options)}]};
    if(!raw||raw.schema!==2) throw new Error('不支持的图表工程版本');
    if(!Array.isArray(raw.charts)||raw.charts.length<1||raw.charts.length>100) throw new Error('每个项目需要 1–100 张图表');
    const ids=new Set();
    const charts=raw.charts.map(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)) throw new Error('图表编号无效');
      if(ids.has(item.id)) throw new Error('图表编号重复');
      ids.add(item.id);return {id:item.id,chart:normalizeProject(item.chart,options)};
    });
    if(!ids.has(raw.activeId))throw new Error('当前图表不存在');
    const activeByType={};
    for(const item of charts) {
      const type=item.chart.type;
      if(!activeByType[type]||raw.activeByType?.[type]===item.id||raw.activeId===item.id)activeByType[type]=item.id;
    }
    activeByType[charts.find(item=>item.id===raw.activeId).chart.type]=raw.activeId;
    return {schema:2,activeId:raw.activeId,activeByType,charts};
  }
  function buildOption(raw) {
    const p=normalizeProject(raw), {type,table,settings:s}=p;
    const rows=table.slice(1), categories=rows.map(r=>r[0]), headers=table[0].slice(1);
    const horizontal=['horizontal-bar','negative-bar','stacked-horizontal','grouped-horizontal'].includes(type);
    const round=['pie','donut','rose','funnel'].includes(type);
    const label={show:s.labels,fontSize:s.labelSize,color:s.textColor,position:s.labelPosition,formatter:params=>s.labelFormat==='name'?params.name:s.labelFormat==='percent'&&params.percent!==undefined?params.percent+'%':String(Array.isArray(params.value)?params.value[params.value.length-1]:params.value??'')};
    const option={backgroundColor:s.background,color:s.colors,animation:s.animation,animationDuration:600,textStyle:{color:s.textColor,fontFamily:'Microsoft YaHei, sans-serif'},title:{text:s.title,subtext:s.subtitle,left:s.titleAlign,top:16,textStyle:{fontSize:s.titleSize,color:s.textColor}},tooltip:{trigger:round||['scatter','radar','river'].includes(type)?'item':'axis',renderMode:'richText'},legend:{show:s.legend,type:'scroll',textStyle:{color:s.textColor},orient:['left','right'].includes(s.legendPosition)?'vertical':'horizontal'},series:[]};
    option.legend[s.legendPosition]=12;
    if(['top','bottom'].includes(s.legendPosition)) option.legend.left='center'; else option.legend.top='middle';
    if(s.legendPosition==='top') option.legend.top=s.subtitle?88:64;
    if(round) {
      if(rows.some(r=>r[1]!==null&&r[1]<0)) throw new Error('饼图、环形图、玫瑰图和漏斗图需要非负数值');
      option.series=[{type:type==='funnel'?'funnel':'pie',name:headers[0],data:rows.map(r=>({name:r[0],value:r[1]})),radius:type==='donut'?['36%','62%']:'62%',center:['50%','55%'],roseType:type==='rose'?'area':undefined,top:110,bottom:65,left:'22%',width:'56%',label:{...label,position:s.labelPosition==='inside'?'inside':'outside'}}];
    } else if(type==='radar') {
      const max=Math.max(1,...rows.flatMap(r=>r.slice(1)).filter(Number.isFinite))*1.15;
      if(rows.some(r=>r.slice(1).some(v=>v!==null&&v<0))) throw new Error('雷达图需要非负数值');
      option.radar={center:['50%','56%'],radius:'58%',indicator:categories.map(name=>({name,max})),splitArea:{show:s.grid},axisLine:{show:s.axis},axisName:{color:s.textColor}};
      option.series=[{type:'radar',label,data:headers.map((name,i)=>({name,value:rows.map(r=>r[i+1]),areaStyle:{opacity:0.08}}))}];
    } else if(type==='river') {
      if(categories.some(v=>!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)) throw new Error('河流图第一列需要 YYYY-MM-DD 日期');
      if(new Set(categories).size!==categories.length) throw new Error('河流图日期不能重复');
      if(rows.some(r=>r.slice(1).some(v=>v===null||v<0))) throw new Error('河流图需要非负且非空的数值');
      option.singleAxis={type:'time',top:110,bottom:75,axisLabel:{color:s.textColor},axisLine:{show:s.axis}};
      const sorted=rows.slice().sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
      option.series=[{type:'themeRiver',label,data:sorted.flatMap(r=>headers.map((name,i)=>[r[0],r[i+1],name]))}];
    } else {
      const axis=(name)=>({type:'value',name:s[name+'Name'],min:s[name+'Min']===''?undefined:s[name+'Min'],max:s[name+'Max']===''?undefined:s[name+'Max'],show:s.axis,splitLine:{show:s.grid,lineStyle:{color:'#e5eaf0'}},nameTextStyle:{color:s.textColor},axisLabel:{color:s.textColor}});
      const category={type:'category',data:categories,show:s.axis,name:horizontal?s.yName:s.xName,axisLabel:{rotate:s.rotate,color:s.textColor},axisLine:{lineStyle:{color:'#ccd5e0'}},axisTick:{show:false}};
      option.grid={left:s.legend&&s.legendPosition==='left'?150:70,right:s.legend&&s.legendPosition==='right'?150:55,top:s.legend&&s.legendPosition==='top'?125:105,bottom:85,containLabel:true};
      option.xAxis=type==='scatter'?axis('x'):horizontal?axis('x'):category;
      option.yAxis=horizontal?category:axis('y');
      if(type==='candlestick') {
        if(headers.length!==4) throw new Error('K 线需要 5 列：日期、开盘、收盘、最低、最高');
        if(rows.some(r=>r.slice(1).some(v=>v===null)||r[3]>Math.min(r[1],r[2])||r[4]<Math.max(r[1],r[2])||r[3]>r[4])) throw new Error('K 线最低价应不高于开盘/收盘，最高价应不低于开盘/收盘，且不得留空');
        option.series=[{type:'candlestick',name:'价格',label,data:rows.map(r=>r.slice(1)),itemStyle:{color:s.colors[0],color0:s.colors[1]||'#39ba9a'}}];
      } else if(type==='waterfall') {
        let total=0; const base=[],up=[],down=[];
        rows.forEach(r=>{const v=r[1]??0, next=total+v;base.push(Math.min(total,next));up.push(v>=0?v:'-');down.push(v<0?-v:'-');total=next;});
        if(base.some(v=>v<0)) throw new Error('瀑布图累计值不能低于 0；请调整初始值');
        option.series=[{type:'bar',name:'辅助',stack:'waterfall',data:base,itemStyle:{color:'transparent'},tooltip:{show:false},emphasis:{disabled:true}},{type:'bar',name:'增加',stack:'waterfall',data:up,label},{type:'bar',name:'减少',stack:'waterfall',data:down,label:{...label,formatter:v=>'-'+v.value}}];
        option.legend.data=['增加','减少'];
      } else {
        const line=['line','grouped-line','area','step','stacked-area'].includes(type);
        const multiple=['grouped-bar','grouped-line','stacked-bar','stacked-horizontal','grouped-horizontal','stacked-area','area','scatter','negative-bar'].includes(type);
        option.series=(multiple?headers:headers.slice(0,1)).map((name,i)=>({name,type:type==='scatter'?'scatter':line?'line':'bar',data:rows.map(r=>type==='scatter'?[r[0],r[i+1]]:r[i+1]),label,stack:['stacked-bar','stacked-horizontal','stacked-area'].includes(type)?'total':undefined,areaStyle:['area','stacked-area'].includes(type)?{opacity:type==='area'?0.25:0.7}:undefined,smooth:s.smooth,step:type==='step'?'end':undefined,symbolSize:type==='scatter'?10:6,barMaxWidth:64,emphasis:{focus:'series'}}));
      }
    }
    return option;
  }
  const api={types,palette,defaults,parseDelimited,toCSV,normalizeTable,normalizeProject,normalizeCollection,buildOption};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.DataChartsCore=api;
})(typeof window==='undefined'?globalThis:window);
