const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'dfmea-requirements.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'dfmea-data.js'), 'utf8'), context);

const lib = context.DFMEA_LIBRARY;
const system = lib.rows.filter((row) => row.level === 1);
const level2 = lib.rows.filter((row) => row.level === 2);
const level3 = lib.rows.filter((row) => row.level === 3);
assert.deepEqual(Array.from(lib.fields), ['C','D','E','F','G','H','I','J','K','L','M','N','O','P']);
assert.equal(lib.originalSystemCount, 37, 'attachment 2 requirement count is retained');
assert.ok(system.length > 37, 'missing parent functions are supplemented at system level');
assert.match(system[0].G, /functional de-rate or damage/, 'original requirement detail is retained');
assert.ok(level2.length >= 80, 'component-level functions and failures are split into individual rows');
assert.ok(level3.length >= 90, 'child functions and failures inherit detailed component rows');
assert.ok(system.every((row) => !row.C && !row.F && !row.I), 'system level leaves C/F/I blank');
assert.equal(new Set(system.map((row) => row.D)).size, 1, 'system D uses one object name');
assert.ok(system.every((row) => row.D === '电气系统'), 'system object name is unified');
assert.ok(level2.every((row) => row.C === '电气系统'), 'component C uses one parent object name');
assert.ok(system.every((row) => row.D && row.G && row.K && row.M && row.O), 'system analysis is complete');
assert.ok(system.filter((row) => ['SYS-45','SYS-46'].includes(row.id)).every((row) => !row.E && !row.H && !row.L), 'clearance and creepage stay at system level');
assert.ok(level3.every((row) => row.C && row.D && row.F && row.G && row.I && row.K && !row.E && !row.H && !row.L), 'child level mapping follows hierarchy');
assert.ok(level2.every((child) => system.some((parent) => parent.D === child.C && parent.G === child.F && parent.K === child.I)), 'every component C/F/I exactly matches one system parent D/G/K');
assert.ok(level3.every((child) => level2.some((parent) => parent.D === child.C && parent.G === child.F && parent.K === child.I)), 'every child-part C/F/I exactly matches one component parent D/G/K');
assert.ok(level2.every((row) => !row.E.includes('/')), 'each component row names only one downstream child');
assert.ok(system.some((row) => row.G === '绝缘：500V电压下，整包绝缘电阻≥200MΩ'));
assert.ok(system.some((row) => row.G === '耐压：2700V电压下，整包漏电流≤1mA'));
assert.ok(system.some((row) => row.G === '电气间隙满足IEC 60664'));
assert.ok(system.some((row) => row.G === '爬电距离满足IEC 60664'));
['EDM（电源分配单元）','保险丝盒','低压线束','汇流排','高压线束','FPC','电芯巴片'].forEach((name) => {
  assert.ok(level2.some((row) => row.D === name && row.G.includes('绝缘：500V')));
  assert.ok(level2.some((row) => row.D === name && row.G.includes('耐压：2700V')));
});
assert.ok(lib.rows.every((row) => [row.J,row.N,row.P].every((score) => score >= 1 && score <= 10)), 'S/O/D scores stay in range');
const children = new Set(level3.map((row) => row.D));
['主继电器','预充继电器','预充电阻','霍尔传感器','EDM铜排','转接PCB','Shunt（电流传感器）','Pyro-fuse','辅助回路保险丝','保险丝盒铜排','低压连接器','线缆','低压接线端子','低压OT端子','水温传感器','高压连接器','高压线缆','互锁低压线缆'].forEach((name) => assert.ok(children.has(name), name));

const templateScript = fs.readFileSync(path.join(__dirname, '..', 'js', 'dfmea-template-data.js'), 'utf8');
vm.runInContext(templateScript, context);
const bytes = Buffer.from(context.DFMEA_TEMPLATE_BASE64, 'base64');
assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'embedded template is a valid ZIP-based workbook');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(index.indexOf('js/vendor/jszip.min.js') < index.indexOf('js/calc-dfmea.js'), 'JSZip loads before DFMEA exporter');

console.log(`PASS DFMEA library: ${system.length} system, ${level2.length} component, ${level3.length} child rows`);
