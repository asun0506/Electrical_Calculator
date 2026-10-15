/** Workbook V3 torque/interface model. Units: mm, N·m, kN, MPa, kg, g.
 * Source cell map and deliberate limitations: docs/螺栓扭矩校核模型说明.md.
 * Preserve workbook constants 3.14 (area), 3.1415926 (helix), and /100 (load).
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoltTorqueCore = api;
})(typeof window === 'undefined' ? globalThis : window, function() {
  'use strict';
  const pitches = Object.freeze({4:.7,5:.8,6:1,8:1.25,10:1.5});
  const number = v => (typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  const automatic = (v, fallback) => v === '' || v == null ? fallback : number(v);
  const le = (a,b) => a <= b + 1e-12 * Math.max(1,Math.abs(b));
  function compute(j) {
    const d=number(j.diameter),torque=number(j.torque),n=number(j.quantity),outer=number(j.outerDiameter),inner=number(j.innerDiameter),stress=number(j.interfaceYield);
    const condition=number(j.conditionFactor),attenuation=number(j.attenuation),tol=number(j.torqueTolerance),friction=number(j.friction),eta=number(j.yieldFactor);
    const checkLoad=j.checkLoad!==false,mass=checkLoad?number(j.mass):0,impact=checkLoad?number(j.impactG):0;
    const pitch=automatic(j.pitch,pitches[d]??null),threadDiameter=automatic(j.threadDiameter,d!=null&&pitch!=null?d-.6495*pitch:null);
    const invalid = error => ({valid:false,error});
    if (!(d>0&&torque>0&&Number.isInteger(n)&&n>=1&&outer>inner&&inner>=0&&stress>0&&condition>0&&attenuation>0&&attenuation<=1&&tol!=null&&tol>=0&&tol<100&&friction>=0&&friction!=null&&eta>0&&eta<=1&&mass!=null&&mass>=0&&impact!=null&&impact>=0&&pitch>0&&threadDiameter>0&&threadDiameter<=d)) return invalid('请检查必填项：直径/扭矩/螺距须大于 0，螺栓数量须为正整数，外径须大于内径，公差应在 0～100%（不含 100%），衰减与屈服系数应在 0～1（不含 0）。非表列直径须填写螺距。');
    const bearingDiameter=(outer+inner)/2;
    const frictionArm=automatic(j.frictionArm,friction*(.577*threadDiameter+.5*bearingDiameter));
    const pitchArm=automatic(j.pitchArm,pitch/(2*3.1415926));
    if (!(frictionArm!=null&&frictionArm>=0&&pitchArm!=null&&pitchArm>=0&&frictionArm+pitchArm>0)) return invalid('I₁、I₂ 应为非负有效数值，且其和须大于 0。');
    const arm=frictionArm+pitchArm,area=3.14*(outer*outer-inner*inner)/4;
    const yieldForce=stress*area/1000,safeForce=yieldForce*eta,nominalForce=torque/arm;
    const maxForce=nominalForce*(1+tol/100),minForce=nominalForce*(1-tol/100);
    const requiredForce=mass*impact*condition/n/attenuation/100;
    const requiredQuantity=checkLoad?Math.max(1,Math.ceil(mass*impact*condition/attenuation/100/minForce)):null;
    const allowableTorque=safeForce*arm,minArea=maxForce/stress*1000;
    const minOuter=2*Math.sqrt(minArea/3.14+(inner/2)**2);
    const innerRadicand=(outer/2)**2-minArea/3.14;
    const maxInner=innerRadicand<0?null:2*Math.sqrt(innerRadicand);
    const requiredYieldForce=nominalForce/eta,requiredStress=requiredYieldForce/area*1000;
    const utilization=nominalForce/yieldForce,workbookK=torque/(safeForce*d);
    const checks=[
      {id:'torque',label:'最大允许扭矩',value:allowableTorque,unit:'N·m',rule:'T ≤ T允许',pass:le(torque,allowableTorque)},
      ...(checkLoad?[
        {id:'quantity',label:'所需螺栓数量',value:requiredQuantity,unit:'颗',rule:'n ≥ n所需',pass:n>=requiredQuantity},
        {id:'load',label:'单颗最小所需轴力',value:requiredForce,unit:'kN',rule:'Fmin ≥ F需',pass:le(requiredForce,minForce)}]:[]),
      {id:'outer',label:'最小允许外径',value:minOuter,unit:'mm',rule:'A ≥ A外径下限',pass:le(minOuter,outer)},
      {id:'inner',label:'最大允许内径',value:maxInner,unit:'mm',rule:'B ≤ B内径上限',pass:maxInner!=null&&le(inner,maxInner)},
      {id:'stress',label:'最小界面屈服应力',value:requiredStress,unit:'MPa',rule:'σy ≥ σ需（名义轴力 / η）',pass:le(requiredStress,stress)},
      {id:'area',label:'最小许用面积',value:minArea,unit:'mm²',rule:'S ≥ Smin（最大轴力）',pass:le(minArea,area)},
      {id:'maxForce',label:'最大螺栓轴力',value:maxForce,unit:'kN',rule:'Fmax ≤ F安全',pass:le(maxForce,safeForce)},
      {id:'utilization',label:'名义屈服利用率',value:utilization*100,unit:'%',rule:'F0 / Fy ≤ η',pass:le(utilization,eta)}
    ];
    const numeric=[area,yieldForce,safeForce,nominalForce,maxForce,minForce,requiredForce,allowableTorque,minArea,minOuter,requiredStress,workbookK];
    if(numeric.some(v=>!Number.isFinite(v))||(checkLoad&&!Number.isSafeInteger(requiredQuantity)))return invalid('计算结果超出有效数值范围，请检查输入数量级。');
    const manualOverrides=['pitch','threadDiameter','frictionArm','pitchArm'].filter(k=>j[k]!==''&&j[k]!=null);
    return {valid:true,d,torque,n,outer,inner,stress,condition,attenuation,tol,friction,eta,mass,impact,checkLoad,pitch,threadDiameter,bearingDiameter,frictionArm,pitchArm,arm,area,yieldForce,safeForce,nominalForce,maxForce,minForce,requiredForce,requiredQuantity,allowableTorque,minArea,minOuter,maxInner,requiredYieldForce,requiredStress,utilization,workbookK,manualOverrides,allowableFrictionArm:torque/safeForce-pitchArm,checks,pass:checks.every(c=>c.pass)};
  }
  return Object.freeze({compute,pitches});
});
