const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {};
context.window = context;
vm.createContext(context);
for (const name of ['standards-data', 'standards-dvpr-supplement', 'part-design-data', 'dvpr-internal-data', 'dvpr-data']) {
  const file = path.join(__dirname, '..', 'js', `${name}.js`);
  if (name === 'part-design-data' && !fs.existsSync(file)) continue;
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
}
const lib = context.DVPR_LIBRARY;
assert.ok(lib.designGuides, 'DVP library provides linked part design guides');
const catalog = context.ELECTRICAL_STANDARD_LIBRARY.records;
assert.equal(new Set(catalog.map(r => r.no)).size, catalog.length);
const added = context.PART_DESIGN_LIBRARY.records;
assert.ok(added.length >= 20, 'targeted material, electrical and PCB/FPC standard coverage');
assert.ok(added.every(r => ['ISO', 'IEC', 'GB', 'IPC'].includes(r.system)), 'no new local/association standards except requested IPC');
assert.ok(added.every(r => r.verifiedAt === '2026-10-13' && r.source.startsWith('https://')));
for (const id of ['IPC-2221', 'IPC-2222', 'IPC-2223', 'IPC-2152', 'IPC-6012', 'IPC-6013', 'IPC-A-600', 'IPC-A-610', 'IPC-J-STD-001', 'IEC 61189-3:2007', 'ISO 1817:2026', 'GB/T 1040.1-2025']) {
  assert.ok(catalog.some(r => r.no === id), `standard library includes ${id}`);
  assert.ok(lib.standards[id], `DVP uses same catalog standard ${id}`);
}
for (const p of lib.products) {
  assert.ok(p.designGroup, `${p.id}: classified product`);
  const guide = lib.designGuides[p.id];
  assert.ok(guide && guide.checks.length >= 3, `${p.id}: substantive design guide`);
  for (const check of guide.checks) {
    assert.ok(check.design && check.boundary, `${p.id}: design and scope advice`);
    assert.ok(lib.standards[check.standard], `${p.id}: standard reference resolves`);
    assert.ok(lib.profiles[p.id].some(row => row[0] === check.item && row[1] === check.standard),
      `${p.id}: design check has an actual DVP row`);
  }
}
const fpc = lib.designGuides.fpc;
assert.ok(fpc.checks.some(c => c.standard === 'IPC-2223' && /弯折/.test(c.item)));
assert.ok(fpc.checks.some(c => c.standard === 'IPC-2152'));
assert.ok(!lib.profiles.fpc.some(row => row[1] === 'IEC 60512'), 'connector test standard not applied to bare FPC');
assert.ok(lib.products.find(p => p.id === 'pcb').recommendedStandards.includes('IPC-2222'));
assert.ok(!lib.products.find(p => p.id === 'pcb').recommendedStandards.includes('IPC-2223'), 'rigid PCB is not flex-specific');
assert.ok(lib.designGuides.fastener.checks.some(c => c.standard.startsWith('ISO 16047')));
assert.ok(lib.designGuides['rubber-o-ring'].checks.some(c => c.standard === 'ISO 1817:2026'));
assert.ok(lib.designGuides.aerogel.checks.some(c => c.standard === 'ISO 8301:1991'));
assert.ok(!lib.designGuides.aerogel.checks.some(c => c.standard === 'ISO 3386-1:2025'), 'flexible foam test not generalized to aerogel');
assert.ok(lib.profiles['hall-sensor'].filter(r => /EMC/.test(r[0])).every(r => r[1] !== 'ISO 16750'), 'EMC uses EMC methods');
assert.equal(Object.values(lib.internalSourceStats).reduce((sum,n)=>sum+n,0), 446, 'internal workbook preserved');
console.log(`PASS linked part design guides for ${lib.products.length} products and authoritative standard catalog`);
