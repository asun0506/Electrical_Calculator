const assert = require('node:assert/strict');
const path = require('node:path');
const runner = require('../scripts/run-tests.cjs');

assert.deepEqual(runner.groups.unit, [
  'tests/busbar-merged.cjs',
  'tests/dfmea.cjs',
  'tests/standards-data.cjs',
]);
assert.ok(runner.groups.browser.includes('tests/schematic-browser.cjs'));
assert.ok(runner.groups.browser.includes('tests/dfmea-browser.cjs'));
const syntax = runner.collectSyntaxFiles(path.resolve(__dirname, '..'));
assert.ok(syntax.some((file) => file.endsWith(path.join('js', 'app.js'))));
assert.ok(syntax.some((file) => file.endsWith(path.join('tests', 'schematic-layout.cjs'))));
assert.ok(!syntax.some((file) => file.includes(path.join('js', 'vendor'))));
console.log('PASS test runner classification');
