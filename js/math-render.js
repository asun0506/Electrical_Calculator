/** Shared offline LaTeX rendering; display rounding never feeds calculations. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/katex/katex.min.js'));
  else root.ElectricalMath=factory(root.katex);
})(typeof window==='undefined'?globalThis:window,function(katex){
  'use strict';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const significant=v=>Number.isFinite(v)?(Object.is(v,-0)?0:v).toPrecision(4):'—';
  const numberTex=v=>significant(v).replace(/e\+?(-?\d+)$/,String.raw`\times 10^{$1}`);
  function render(tex,display=true){
    try{return `<span class="math-formula">${katex.renderToString(String(tex),{displayMode:display,throwOnError:true,trust:false,strict:'error',output:'htmlAndMathml',maxExpand:1000})}</span>`;}
    catch(error){return `<span class="math-error" role="note" title="${escape(error.message)}">${escape(tex)}</span>`;}
  }
  return Object.freeze({significant,numberTex,render});
});
