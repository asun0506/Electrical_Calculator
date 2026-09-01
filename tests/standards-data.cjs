const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = { window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'standards-data.js'), 'utf8'), context);

const records = context.ELECTRICAL_STANDARD_LIBRARY.records;
const connectors = records.filter((item) => item.topic === '高低压连接器');
const lv = connectors.filter((item) => item.system === 'LV');
const uscar = connectors.filter((item) => item.system === 'USCAR');

assert.ok(records.length >= 80, 'expanded standard library');
assert.ok(lv.length >= 10, 'LV system coverage');
assert.ok(uscar.length >= 14, 'USCAR system coverage');
assert.ok(lv.some((item) => item.no.startsWith('LV 214')));
assert.ok(lv.some((item) => item.no.startsWith('LV 215')));
assert.ok(uscar.some((item) => item.no === 'SAE/USCAR-2'));
assert.ok(uscar.some((item) => item.no === 'SAE/USCAR-21'));
assert.ok(uscar.some((item) => item.no === 'SAE/USCAR-37'));
assert.ok(lv.every((item) => /OEM|配套/.test(item.status)), 'LV records warn that the project/OEM version controls');
assert.equal(new Set(records.map((item) => item.no)).size, records.length, 'standard numbers are unique');
assert.ok(records.every((item) => item.summary && item.focus.length && /^https:\/\//.test(item.source)));

console.log(`PASS standards data: ${records.length} total, ${lv.length} LV, ${uscar.length} USCAR`);
