/** Offline R/L/C engineering estimates; no circuit certification or mutual-inductance solver. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window!=='undefined')root.BatteryRLC=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function finite(value,name,min=0){if(!Number.isFinite(value)||value<min)throw Error(`${name}无效`);return value;}
  function inductanceUh(lengthMm,widthMm,heightMm){
    [lengthMm,widthMm,heightMm].forEach(v=>finite(v,'导体尺寸',Number.MIN_VALUE));
    if(lengthMm<10*(widthMm+heightMm))throw Error('非细长直段，请输入电感或使用实测整回路电感');
    return .0002*lengthMm*(Math.log(2*lengthMm/(widthMm+heightMm))+.5+.2235*(widthMm+heightMm)/lengthMm);
  }
  function network(tokens,map){
    let i=0;
    function term(){const t=tokens[i++];if(t==='('){const v=expression();if(tokens[i++]!==')')throw Error('电感网络缺少右括号');return v;}if(typeof t==='number')return{r:finite(t,'常量电阻'),l:0};const v=typeof t==='string'&&map[Number(t.slice(1))];if(!v)throw Error('电感网络引用未定义');return{r:finite(v.r,'电阻',Number.MIN_VALUE),l:finite(v.l,'电感')};}
    function expression(){let a=term();while(i<tokens.length&&['+','//'].includes(tokens[i])){const op=tokens[i++],b=term();if(op==='+')a={r:a.r+b.r,l:a.l+b.l};else if(a.r===0||b.r===0)a={r:0,l:0};else{const r=a.r*b.r/(a.r+b.r);a={r,l:r*r*(a.l/(a.r*a.r)+b.l/(b.r*b.r))};}}return a;}
    const value=expression();if(i!==tokens.length)throw Error('电感网络表达式错误');return value;
  }
  function shortCircuit(voltage,resistance,inductance){
    finite(voltage,'整包电压',Number.MIN_VALUE);finite(resistance,'回路电阻',Number.MIN_VALUE);finite(inductance,'回路电感');
    const finalCurrent=voltage/resistance,tau=inductance/resistance;
    if(!Number.isFinite(finalCurrent)||!Number.isFinite(tau))throw Error('短路计算超出数值范围');
    return{finalCurrent,tau,currentAt:t=>{finite(t,'时间');return tau===0?finalCurrent:finalCurrent*(-Math.expm1(-t/tau));}};
  }
  function capacitance({voltage,yNf,areaCm2,gapMm,er,includeStray=false}){
    finite(voltage,'整包电压',Number.MIN_VALUE);finite(areaCm2,'重叠面积');finite(gapMm,'导体间距',Number.MIN_VALUE);finite(er,'相对介电常数',1);
    if(yNf!=null)finite(yNf,'Y电容');
    const parasiticF=8.8541878128e-12*er*(areaCm2*1e-4)/(gapMm*1e-3),yF=yNf==null?null:yNf*1e-9;
    const yEnergy=yF==null?null:.5*yF*voltage*voltage,touchF=yF==null?null:yF+(includeStray?parasiticF:0);
    const energy=touchF==null?null:.5*touchF*voltage*voltage,maxTouchF=.4/(voltage*voltage);
    if(![parasiticF,maxTouchF,...(energy==null?[]:[energy])].every(Number.isFinite))throw Error('电容计算超出数值范围');
    return{parasiticF,yEnergy,touchF,energy,maxTouchF,energyPass:energy==null?null:(.2-energy)>Number.EPSILON*16*.2};
  }
  return Object.freeze({inductanceUh,network,shortCircuit,capacitance});
});
