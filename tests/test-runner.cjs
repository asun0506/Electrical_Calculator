const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'electrical-test-runner-'));
const worktreeFile = path.join(fixtureRoot, '.worktrees', 'parallel-change', 'temporary.cjs');
try {
  fs.mkdirSync(path.dirname(worktreeFile), { recursive: true });
  fs.writeFileSync(worktreeFile, 'module.exports = true;');
  assert.ok(!runner.collectSyntaxFiles(fixtureRoot).includes(worktreeFile));
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('PASS test runner classification');
