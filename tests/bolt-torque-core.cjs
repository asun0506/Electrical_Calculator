// Workbook cached values are independent reference values, not computed by this core.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', 'js', 'bolt-torque-core.js');
assert.ok(fs.existsSync(file), 'workbook torque calculation core must exist');
const M = require(file);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const base = {diameter:5, torque:5, mass:.4, impactG:50, quantity:2, outerDiameter:8.6,
  innerDiameter:6, interfaceYield:400, conditionFactor:1.3, attenuation:.6,
  torqueTolerance:12.5, friction:.18, yieldFactor:.75, checkLoad:true,
  pitch:'', threadDiameter:'', frictionArm:'', pitchArm:''};
const r = M.compute(base);
assert.equal(r.valid, true);
for (const [key, expected] of Object.entries({pitch:.8, threadDiameter:4.4804,
  frictionArm:1.122334344, pitchArm:.12732395664542881, area:29.7986,
  yieldForce:11.91944, safeForce:8.93958, nominalForce:4.001093736917987,
  maxForce:4.5012304540327355, minForce:3.5009570198032387,
  requiredForce:.21666666666666667, allowableTorque:11.17142035128386,
  minArea:11.253076135081839, minOuter:7.0947254234747632,
  maxInner:7.721714263393903, requiredStress:179.02826472465094,
  utilization:.33567799635872053, workbookK:.11186207853165361})) close(r[key],expected);
assert.equal(r.requiredQuantity,1);
assert.equal(r.pass,true);
assert.ok(r.checks.every(c => c.pass === true));
assert.equal(M.compute({...base,torque:15}).pass,false,'high torque must fail interface checks');
assert.equal(M.compute({...base,mass:40}).pass,false,'insufficient residual clamp force fails');
assert.equal(M.compute({...base,mass:40}).requiredQuantity,13,'quantity is rounded up, never a fixed 1');
assert.equal(M.compute({...base,torque:0}).valid,false);
assert.equal(M.compute({...base,quantity:1.5}).valid,false);
assert.equal(M.compute({...base,torqueTolerance:100}).valid,false);
assert.equal(M.compute({...base,innerDiameter:9}).valid,false);
assert.equal(M.compute({...base,attenuation:0}).valid,false);
assert.equal(M.compute({...base,mass:''}).valid,false,'blank mass is not zero');
assert.equal(M.compute({...base,friction:' '}).valid,false);
assert.equal(M.compute({...base,mass:'',impactG:'',checkLoad:false}).valid,true,'disabled load inputs are not required');
assert.equal(M.compute({...base,mass:0}).requiredForce,0);
assert.equal(M.compute({...base,frictionArm:0,pitchArm:0}).valid,false);
close(M.compute({...base,pitch:1,threadDiameter:4,frictionArm:1,pitchArm:.25}).nominalForce,4);
assert.deepEqual(M.compute({...base,pitch:1,threadDiameter:4,frictionArm:1,pitchArm:.25}).manualOverrides,['pitch','threadDiameter','frictionArm','pitchArm']);
assert.equal(M.compute({...base,diameter:7}).valid,false,'unlisted diameter needs explicit pitch');
assert.equal(M.compute({...base,diameter:7,pitch:1}).valid,true);
const boundary = M.compute({...base,torque:r.allowableTorque,torqueTolerance:0});
assert.equal(boundary.checks.find(c=>c.id==='torque').pass,true,'equality passes workbook <= boundary');
console.log('PASS workbook bolt torque formulas, cached values, counts, limits and optional load');
