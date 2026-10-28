/* Styled editable tables and native DrawingML table export; no DOM dependencies. */
(function(root){
  'use strict';
  const p18=typeof module==='object'&&module.exports?require('./presentation-palettes.js').p18:root.PresentationPalettes.p18;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
  const fonts=['Microsoft YaHei','DengXian','SimSun','Arial','Calibri','Aptos'];
  const presets=[
    {id:'blue',name:'商务蓝',headerFill:'#173b5e',headerColor:'#ffffff',fill:'#ffffff',stripeFill:'#eaf1f8',color:'#1e293b',borderColor:'#b8cadb',borderMode:'all'},
    {id:'green',name:'清新绿',headerFill:'#277452',headerColor:'#ffffff',fill:'#ffffff',stripeFill:'#edf6ee',color:'#244334',borderColor:'#bcd9c3',borderMode:'all'},
    {id:'orange',name:'暖橙',headerFill:'#c76a24',headerColor:'#ffffff',fill:'#ffffff',stripeFill:'#fff3e6',color:'#623d22',borderColor:'#e7c6a4',borderMode:'all'},
    {id:'purple',name:'典雅紫',headerFill:'#7155a5',headerColor:'#ffffff',fill:'#ffffff',stripeFill:'#f2eef8',color:'#403353',borderColor:'#d2c4e4',borderMode:'all'},
    {id:'gray',name:'简约灰',headerFill:'#e2e8f0',headerColor:'#1e293b',fill:'#ffffff',stripeFill:'#f8fafc',color:'#334155',borderColor:'#cbd5e1',borderMode:'all'},
    {id:'lines',name:'水平线',headerFill:'#ffffff',headerColor:'#173b5e',fill:'#ffffff',stripeFill:'#ffffff',color:'#334155',borderColor:'#94a3b8',borderMode:'rows'},
    {id:'dark',name:'深色',headerFill:'#0f172a',headerColor:'#ffffff',fill:'#253449',stripeFill:'#334155',color:'#f1f5f9',borderColor:'#52647b',borderMode:'all'},
    {id:'minimal',name:'无边框',headerFill:'#f1f5f9',headerColor:'#173b5e',fill:'#ffffff',stripeFill:'#f8fafc',color:'#334155',borderColor:'#cbd5e1',borderMode:'none'},
    {id:'p18-review',name:'浅青',headerFill:p18.pale,headerColor:p18.ink,fill:p18.white,stripeFill:p18.tableGray,color:p18.ink,borderColor:p18.lightGray,borderMode:'all'},
    {id:'p18-navy',name:'深蓝',headerFill:p18.navy,headerColor:p18.white,fill:p18.white,stripeFill:p18.pale,color:p18.ink,borderColor:p18.lightGray,borderMode:'all'}
  ];
  function defaults(){return {schema:1,kind:'styled-table',title:'项目进度表',cells:[['项目','负责人','状态','完成率'],['方案设计','张工','已完成','100%'],['样件制作','李工','进行中','75%'],['试验验证','王工','进行中','40%'],['报告交付','赵工','待开始','0%']],width:900,rowHeight:44,padding:10,fontSize:16,fontFamily:'Microsoft YaHei',bold:false,align:'left',vertical:'middle',header:true,stripes:true,firstColumn:false,borderWidth:1,borderDash:'solid',...clone(presets[0]),overrides:{}};}
  function normalize(raw){
    if(!raw||raw.schema!==1||raw.kind!=='styled-table')throw new Error('不支持的表格工程格式');
    const s=defaults();
    const sizes={width:[240,1800,'宽度'],rowHeight:[24,160,'行高'],padding:[0,30,'内边距'],fontSize:[8,48,'字号'],borderWidth:[0,6,'边框宽度']};
    for(const [key,[lo,hi,label]]of Object.entries(sizes)){
      const n=Number(raw[key]);if(!Number.isFinite(n)||n<lo||n>hi)throw new Error(`${label}需要在 ${lo}–${hi} 范围内`);s[key]=n;
    }
    for(const key of ['headerFill','headerColor','fill','stripeFill','color','borderColor']){
      if(!/^#[0-9a-f]{6}$/i.test(raw[key]))throw new Error('颜色格式无效');s[key]=raw[key].toLowerCase();
    }
    for(const key of ['header','stripes','firstColumn','bold']){if(typeof raw[key]!=='boolean')throw new Error('表格开关无效');s[key]=raw[key];}
    for(const [key,values]of Object.entries({align:['left','center','right'],vertical:['top','middle','bottom'],borderMode:['all','outer','rows','none'],borderDash:['solid','dashed','dotted'],fontFamily:fonts})){
      if(!values.includes(raw[key]))throw new Error('表格样式选项无效');s[key]=raw[key];
    }
    if(typeof raw.title!=='string'||raw.title.length>200)throw new Error('表格名称不能超过 200 字');s.title=raw.title;
    if(!Array.isArray(raw.cells)||raw.cells.length<1||raw.cells.length>50||!Array.isArray(raw.cells[0])||raw.cells[0].length<1||raw.cells[0].length>20)throw new Error('表格行列需要在 1–50 行、1–20 列范围内');
    const cols=raw.cells[0].length;
    s.cells=raw.cells.map(row=>{
      if(!Array.isArray(row)||row.length!==cols)throw new Error('表格行列不一致');
      return row.map(value=>{if(!['number','string'].includes(typeof value)||String(value).length>2000)throw new Error('单元格内容需要为不超过 2000 字的文字');return String(value);});
    });
    if(raw.overrides===null||typeof raw.overrides!=='object'||Array.isArray(raw.overrides))throw new Error('单元格格式无效');
    s.overrides={};
    for(const [key,value]of Object.entries(raw.overrides)){
      if(!/^\d+:\d+$/.test(key)||!value||typeof value!=='object')throw new Error('单元格格式无效');
      const [r,c]=key.split(':').map(Number);if(r>=s.cells.length||c>=cols)throw new Error('单元格格式超出表格范围');
      const v={};
      for(const k of ['fill','color'])if(value[k]!==undefined){if(!/^#[0-9a-f]{6}$/i.test(value[k]))throw new Error('单元格颜色无效');v[k]=value[k];}
      if(value.bold!==undefined){if(typeof value.bold!=='boolean')throw new Error('单元格字体无效');v.bold=value.bold;}
      if(value.align!==undefined){if(!['left','center','right'].includes(value.align))throw new Error('单元格对齐无效');v.align=value.align;}
      s.overrides[key]=v;
    }
    s.id=presets.some(p=>p.id===raw.id)?raw.id:'blue';s.name=presets.find(p=>p.id===s.id).name;
    return s;
  }
  function resize(raw,rows,cols){
    const s=normalize(raw);
    if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||rows>50||cols<1||cols>20)throw new Error('表格行列需要在 1–50 行、1–20 列范围内');
    s.cells=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>s.cells[r]?.[c]??''));
    for(const key of Object.keys(s.overrides)){const [r,c]=key.split(':').map(Number);if(r>=rows||c>=cols)delete s.overrides[key];}
    return s;
  }
  function cellStyle(s,r,c){
    return {fill:r===0&&s.header?s.headerFill:s.stripes&&r%2===1?s.stripeFill:s.fill,color:r===0&&s.header?s.headerColor:s.color,bold:s.bold||(r===0&&s.header)||(c===0&&s.firstColumn),align:s.align,...s.overrides[r+':'+c]};
  }
  function borderEdges(s,r,c){
    if(!s.borderWidth||s.borderMode==='none')return [];
    if(s.borderMode==='all')return ['top','right','bottom','left'];
    if(s.borderMode==='rows')return ['bottom'];
    return [r===0?'top':null,c===s.cells[0].length-1?'right':null,r===s.cells.length-1?'bottom':null,c===0?'left':null].filter(Boolean);
  }
  function css(s,r,c){
    const v=cellStyle(s,r,c),edges=borderEdges(s,r,c);
    return `box-sizing:border-box;background-color:${v.fill};color:${v.color};font-family:'${s.fontFamily}';font-size:${s.fontSize}pt;font-weight:${v.bold?'bold':'normal'};text-align:${v.align};vertical-align:${s.vertical};padding:${s.padding}px;height:${s.rowHeight}px;white-space:pre-wrap;overflow-wrap:anywhere;`+['top','right','bottom','left'].map(edge=>`border-${edge}:${edges.includes(edge)?s.borderWidth+'px '+s.borderDash+' '+s.borderColor:'0 none'};`).join('');
  }
  function toHTML(raw){const s=normalize(raw);return `<table xmlns="http://www.w3.org/1999/xhtml" style="border-collapse:collapse;table-layout:fixed;width:${s.width}px" width="${s.width}"><colgroup>${s.cells[0].map(()=>`<col width="${s.width/s.cells[0].length}">`).join('')}</colgroup><tbody>${s.cells.map((row,r)=>`<tr>${row.map((v,c)=>`<td style="${css(s,r,c)}" width="${s.width/row.length}">${escape(v).replace(/\n/g,'<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
  const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const a='http://schemas.openxmlformats.org/drawingml/2006/main',p='http://schemas.openxmlformats.org/presentationml/2006/main',r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rels=items=>declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${r}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
  const treeStart='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  const colorMap='<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
  function pptxFiles(raw){
    const s=normalize(raw),files={},emu=px=>Math.round(px*9525),hex=value=>value.slice(1).toUpperCase();
    const width=Math.min(s.width,1160),colWidth=width/s.cells[0].length;
    const rowHeight=row=>Math.max(s.rowHeight,...row.map((text,c)=>{
      const charWidth=s.fontSize*96/72*0.58,capacity=Math.max(1,(colWidth-s.padding*2)/charWidth);
      const units=line=>Array.from(line).reduce((sum,ch)=>sum+(/[\u2e80-\uffff]/.test(ch)?1.8:1),0);
      return text.split('\n').reduce((lines,line)=>lines+Math.max(1,Math.ceil(units(line)/capacity)),0)*s.fontSize*96/72*1.3+s.padding*2;
    }));
    const heights=s.cells.map(rowHeight),pages=[];
    if(heights.some(h=>h>600))throw new Error('有单行内容超出幻灯片高度，请减少文字、字号或列数后导出');
    let current=[],height=0;
    s.cells.forEach((_,index)=>{
      if(current.length&&height+heights[index]>600){pages.push(current);current=s.header&&index>0?[0]:[];height=current.length?heights[0]:0;}
      if(height+heights[index]>600)throw new Error('表头与单行内容超出幻灯片高度，请减小字号或内容');
      current.push(index);height+=heights[index];
    });if(current.length)pages.push(current);
    const overrides=[['/ppt/presentation.xml','application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'],['/ppt/slideMasters/slideMaster1.xml','application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml'],['/ppt/slideLayouts/slideLayout1.xml','application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml'],['/ppt/theme/theme1.xml','application/vnd.openxmlformats-officedocument.theme+xml'],...pages.map((_,i)=>['/ppt/slides/slide'+(i+1)+'.xml','application/vnd.openxmlformats-officedocument.presentationml.slide+xml'])];
    files['[Content_Types].xml']=declaration+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.map(([part,type])=>`<Override PartName="${part}" ContentType="${type}"/>`).join('')}</Types>`;
    files['_rels/.rels']=rels([['rId1','officeDocument','ppt/presentation.xml']]);
    files['ppt/presentation.xml']=declaration+`<p:presentation xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${pages.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
    files['ppt/_rels/presentation.xml.rels']=rels([['rId1','slideMaster','slideMasters/slideMaster1.xml'],...pages.map((_,i)=>['rId'+(i+2),'slide','slides/slide'+(i+1)+'.xml'])]);
    files['ppt/slideMasters/slideMaster1.xml']=declaration+`<p:sldMaster xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:cSld><p:spTree>${treeStart}</p:spTree></p:cSld>${colorMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`;
    files['ppt/slideMasters/_rels/slideMaster1.xml.rels']=rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml'],['rId2','theme','../theme/theme1.xml']]);
    files['ppt/slideLayouts/slideLayout1.xml']=declaration+`<p:sldLayout xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${treeStart}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
    files['ppt/slideLayouts/_rels/slideLayout1.xml.rels']=rels([['rId1','slideMaster','../slideMasters/slideMaster1.xml']]);
    files['ppt/theme/theme1.xml']=declaration+`<a:theme xmlns:a="${a}" name="Table theme"><a:themeElements><a:clrScheme name="Office">${[['dk1','000000'],['lt1','FFFFFF'],['dk2','173B5E'],['lt2','EAF1F8'],['accent1','4472C4'],['accent2','ED7D31'],['accent3','A5A5A5'],['accent4','FFC000'],['accent5','5B9BD5'],['accent6','70AD47'],['hlink','0563C1'],['folHlink','954F72']].map(([name,color])=>`<a:${name}><a:srgbClr val="${color}"/></a:${name}>`).join('')}</a:clrScheme><a:fontScheme name="Office"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst>${[1,2,3].map(()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')}</a:fillStyleLst><a:lnStyleLst>${[9525,19050,28575].map(w=>`<a:ln w="${w}"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>`).join('')}</a:lnStyleLst><a:effectStyleLst>${[1,2,3].map(()=>'<a:effectStyle><a:effectLst/></a:effectStyle>').join('')}</a:effectStyleLst><a:bgFillStyleLst>${[1,2,3].map(()=>'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>').join('')}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
    pages.forEach((indices,page)=>{
      const body=indices.map(index=>`<a:tr h="${emu(heights[index])}">${s.cells[index].map((text,c)=>{
        const v=cellStyle(s,index,c),edges=borderEdges(s,index,c);
        const borders=['L','R','T','B'].map((side,i)=>`<a:ln${side} w="${Math.round(s.borderWidth*9525)}">${edges.includes(['left','right','top','bottom'][i])?`<a:solidFill><a:srgbClr val="${hex(s.borderColor)}"/></a:solidFill><a:prstDash val="${{solid:'solid',dashed:'dash',dotted:'sysDot'}[s.borderDash]}"/>`:'<a:noFill/>'}</a:ln${side}>`).join('');
        const paragraphs=text.split('\n').map(line=>`<a:p><a:pPr algn="${{left:'l',center:'ctr',right:'r'}[v.align]}"/><a:r><a:rPr lang="zh-CN" sz="${Math.round(s.fontSize*100)}" b="${v.bold?1:0}"><a:solidFill><a:srgbClr val="${hex(v.color)}"/></a:solidFill><a:latin typeface="${escape(s.fontFamily)}"/><a:ea typeface="${escape(s.fontFamily)}"/></a:rPr><a:t xml:space="preserve">${escape(line)}</a:t></a:r></a:p>`).join('');
        return `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</a:txBody><a:tcPr marL="${emu(s.padding)}" marR="${emu(s.padding)}" marT="${emu(s.padding)}" marB="${emu(s.padding)}" anchor="${{top:'t',middle:'ctr',bottom:'b'}[s.vertical]}">${borders}<a:solidFill><a:srgbClr val="${hex(v.fill)}"/></a:solidFill></a:tcPr></a:tc>`;
      }).join('')}</a:tr>`).join('');
      const tableHeight=indices.reduce((sum,index)=>sum+heights[index],0);
      files[`ppt/slides/slide${page+1}.xml`]=declaration+`<p:sld xmlns:a="${a}" xmlns:r="${r}" xmlns:p="${p}"><p:cSld name="${escape(s.title)}"><p:spTree>${treeStart}<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="2" name="${escape(s.title)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu((1280-width)/2)}" y="${emu(50)}"/><a:ext cx="${emu(width)}" cy="${emu(tableHeight)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${s.cells[0].map(()=>`<a:gridCol w="${emu(colWidth)}"/>`).join('')}</a:tblGrid>${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
      files[`ppt/slides/_rels/slide${page+1}.xml.rels`]=rels([['rId1','slideLayout','../slideLayouts/slideLayout1.xml']]);
    });return files;
  }
  const api={presets,fonts,defaults,normalize,resize,cellStyle,borderEdges,css,toHTML,pptxFiles,escape};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TableToolsCore=api;
})(typeof window==='undefined'?globalThis:window);
