const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const groups = Object.freeze({
  browser: [
    'tests/bolt-print-layout.cjs',
    'tests/bolt-suite.cjs',
    'tests/dfmea-browser.cjs',
    'tests/drafts-and-report.cjs',
    'tests/dvpr-browser.cjs',
    'tests/dvpr-internal-database.cjs',
    'tests/english-reports.cjs',
    'tests/formula-regression.cjs',
    'tests/import-safety-browser.cjs',
    'tests/schematic-browser.cjs',
    'tests/schematic-layout.cjs',
    'tests/schematic-print-layout.cjs',
    'tests/standards-library.cjs',
  ],
  unit: [
    'tests/safety.cjs',
    'tests/busbar-merged.cjs',
    'tests/dfmea.cjs',
    'tests/standards-data.cjs',
  ],
});

const defaultRoot = path.resolve(__dirname, '..');
const excludedDirectoryNames = new Set(['.git', '.worktrees', 'node_modules', 'output', 'tmp']);

function collectSyntaxFiles(root) {
  const resolvedRoot = path.resolve(root);
  const files = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(resolvedRoot, fullPath);
      if (entry.isDirectory()) {
        if (excludedDirectoryNames.has(entry.name) || relativePath === path.join('js', 'vendor')) continue;
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.cjs'))) {
        files.push(fullPath);
      }
    }
  }

  walk(resolvedRoot);
  return files.sort((a, b) => a.localeCompare(b));
}

function runNode(argumentsList, root) {
  const result = spawnSync(process.execPath, argumentsList, { stdio: 'inherit', cwd: root });
  return result.status === 0;
}

function runSyntax(root) {
  let passed = true;
  for (const file of collectSyntaxFiles(root)) {
    passed = runNode(['--check', file], root) && passed;
  }
  return passed;
}

function isRunnerClassificationTest(root) {
  return path.resolve(require.main?.filename || '') === path.join(root, 'tests', 'test-runner.cjs');
}

function runTests(name, root) {
  const files = [...groups[name]];
  if (name === 'unit' && !isRunnerClassificationTest(root)) files.push('tests/test-runner.cjs');

  let passed = true;
  for (const file of files) {
    passed = runNode([file], root) && passed;
  }
  return passed;
}

function runGroup(name, options = {}) {
  const root = path.resolve(options.root || defaultRoot);
  if (name === 'syntax') return runSyntax(root);
  if (name === 'unit' || name === 'browser') return runTests(name, root);
  if (name === 'all') {
    const syntaxPassed = runSyntax(root);
    const unitPassed = runTests('unit', root);
    const browserPassed = runTests('browser', root);
    return syntaxPassed && unitPassed && browserPassed;
  }
  throw new Error(`Unknown test group: ${name}`);
}

module.exports = { groups, collectSyntaxFiles, runGroup };

if (require.main === module) {
  process.exitCode = runGroup(process.argv[2] || 'all') ? 0 : 1;
}
