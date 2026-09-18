# Electrical Calculator Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calculator's tests reproducible, protect engineering results with golden cases, unify browser persistence and input safety, and split the schematic monolith without changing the static offline runtime.

**Architecture:** Keep the existing ordered classic-script application and add development-only package tooling. Introduce two small browser globals, `ElectricalSafety` and `ElectricalStorage`, then extract the schematic into classic scripts under `js/schematic/` while preserving `ElectricalToolkit`, saved-data formats, `file://` operation, and Cloudflare Pages deployment.

**Tech Stack:** HTML5, CSS, classic browser JavaScript, Node.js CommonJS test scripts, Corepack/pnpm, Playwright Chromium, IndexedDB, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-18-foundation-hardening-design.md`

## Global Constraints

- The published calculator remains a static site with no backend, build step, runtime package installation, or required local server.
- `index.html` must continue to work when opened directly through `file://` and without network access.
- Existing calculator IDs, storage keys, IndexedDB database names, exported JSON shapes, report values, and public globals remain backward compatible.
- `node_modules`, browser binaries, reports, and generated test artifacts must not be committed or published.
- New behavior and bug fixes follow red-green-refactor; extraction-only changes must remain covered by passing characterization tests.
- Do not change an engineering formula while moving code. Formula corrections require a separate failing test and an explicit source for the corrected expectation.

---

### Task 1: Reproducible Test Toolchain

**Files:**
- Create: `package.json`
- Generate: `pnpm-lock.yaml`
- Create: `scripts/run-tests.cjs`
- Create: `tests/test-runner.cjs`
- Modify: `.gitignore`
- Modify: `README_开发维护说明.md`

**Interfaces:**
- Produces: `pnpm test`, `pnpm test:syntax`, `pnpm test:unit`, and `pnpm test:browser`.
- Produces: `scripts/run-tests.cjs` exports `groups`, `collectSyntaxFiles(root)`, and `runGroup(name, options)` when required as a module.
- Consumes: repository-local `playwright` and `jszip` packages.

- [ ] **Step 1: Write the failing runner-classification test**

Create `tests/test-runner.cjs`:

```js
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
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `node tests/test-runner.cjs`

Expected: FAIL with `Cannot find module '../scripts/run-tests.cjs'`.

- [ ] **Step 3: Add the manifest and deterministic runner**

Create `package.json`:

```json
{
  "name": "electrical-calculator",
  "version": "2.0.0",
  "private": true,
  "description": "Offline-first electrical engineering calculator",
  "scripts": {
    "test:syntax": "node scripts/run-tests.cjs syntax",
    "test:unit": "node scripts/run-tests.cjs unit",
    "test:browser": "node scripts/run-tests.cjs browser",
    "test": "node scripts/run-tests.cjs all"
  },
  "devDependencies": {
    "jszip": "^3.10.1",
    "playwright": "^1.55.0"
  }
}
```

Implement `scripts/run-tests.cjs` with explicit, alphabetized test groups. It must recursively collect first-party `.js` and `.cjs` files, exclude `js/vendor`, `node_modules`, `output`, and `tmp`, run `node --check` for syntax, and use `spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: root })` for test files. Do not shell-concatenate commands.

The browser group contains the eleven existing tests that import Playwright. The unit group contains the three existing pure Node tests plus `tests/test-runner.cjs`; the runner must exclude its own test when `tests/test-runner.cjs` invokes exported helpers.

- [ ] **Step 4: Ignore development artifacts**

Append these entries to `.gitignore`:

```gitignore
node_modules/
playwright-report/
test-results/
.pnpm-store/
```

- [ ] **Step 5: Install declared packages and Chromium**

Run:

```powershell
corepack pnpm install
corepack pnpm exec playwright install chromium
```

Expected: `pnpm-lock.yaml` and local `node_modules` are created; Chromium installation exits 0. Do not run a global npm repair as part of this repository task.

- [ ] **Step 6: Verify the runner test and baseline suites**

Run:

```powershell
node tests/test-runner.cjs
corepack pnpm test:syntax
corepack pnpm test:unit
corepack pnpm test:browser
```

Expected: the runner and syntax checks pass. Record any browser assertion failure as a pre-existing behavioral defect; missing-package and missing-browser failures are not acceptable after installation.

- [ ] **Step 7: Document the optional developer setup**

Add a “开发测试环境” section to `README_开发维护说明.md` stating that end users still open `index.html` directly, while contributors run `corepack pnpm install`, `corepack pnpm exec playwright install chromium`, and `corepack pnpm test`.

- [ ] **Step 8: Commit the toolchain**

```powershell
git add package.json pnpm-lock.yaml scripts/run-tests.cjs tests/test-runner.cjs .gitignore README_开发维护说明.md
git commit -m "test: make browser suite reproducible"
```

---

### Task 2: Golden Engineering Regression Cases

**Files:**
- Create: `tests/fixtures/formula-cases.json`
- Create: `tests/formula-regression.cjs`
- Modify: `scripts/run-tests.cjs`
- Modify: `README_开发维护说明.md`

**Interfaces:**
- Consumes: `index.html`, `window.ElectricalToolkit.open(id)`, and the existing calculator DOM.
- Produces: versioned cases with `module`, `inputs`, `expected`, `absoluteTolerance`, `source`, and `caseType` fields.
- Produces: one Playwright test that runs cases against the real UI under `file://`.

- [ ] **Step 1: Write a failing fixture-contract test**

At the top of `tests/formula-regression.cjs`, load the fixture and assert:

```js
const assert = require('node:assert/strict');
const cases = require('./fixtures/formula-cases.json');

assert.equal(cases.schemaVersion, 1);
for (const id of ['relay-fuse', 'conductor', 'precharge', 'busbar-temp', 'iec60664', 'bolt', 'tolerance']) {
  const selected = cases.cases.filter((item) => item.module === id);
  assert.ok(selected.some((item) => item.caseType === 'nominal'), `${id}: nominal case`);
  assert.ok(selected.some((item) => item.caseType === 'boundary'), `${id}: boundary case`);
  assert.ok(selected.some((item) => item.caseType === 'invalid'), `${id}: invalid case`);
}
```

- [ ] **Step 2: Run it and verify the expected failure**

Run: `node tests/formula-regression.cjs`

Expected: FAIL because `tests/fixtures/formula-cases.json` does not exist.

- [ ] **Step 3: Add the fixture schema and independently checked seed values**

Create `tests/fixtures/formula-cases.json` with schema version 1. Seed the directly auditable cases first:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "id": "precharge-400v-1500uf-95pct-500ms",
      "module": "precharge",
      "caseType": "nominal",
      "inputs": { "capacitanceUf": 1500, "voltageV": 400, "targetPercent": 95, "timeMs": 500 },
      "expected": { "resistanceOhm": 111.269, "peakCurrentA": 3.594, "storedEnergyJ": 120 },
      "absoluteTolerance": { "resistanceOhm": 0.002, "peakCurrentA": 0.002, "storedEnergyJ": 0.001 },
      "source": "R=-t/(C ln(1-f)); I=V/R; E=CV^2/2"
    },
    {
      "id": "relay-pack-400v-100mohm",
      "module": "relay-fuse",
      "caseType": "nominal",
      "inputs": { "voltageV": 400, "directResistanceMohm": 100 },
      "expected": { "shortCircuitCurrentA": 4000 },
      "absoluteTolerance": { "shortCircuitCurrentA": 0.01 },
      "source": "I=U/R"
    },
    {
      "id": "tolerance-two-equal-links",
      "module": "tolerance",
      "caseType": "nominal",
      "inputs": { "nominalsMm": [10, 20], "tolerancesMm": [0.1, 0.1], "signs": [1, 1] },
      "expected": { "nominalMm": 30, "worstToleranceMm": 0.2, "rssToleranceMm": 0.1414213562 },
      "absoluteTolerance": { "nominalMm": 0.000001, "worstToleranceMm": 0.000001, "rssToleranceMm": 0.000001 },
      "source": "worst=sum(abs(t)); RSS=sqrt(sum(t^2))"
    }
  ]
}
```

For the remaining required case types, calculate expected values from formulas and bundled tables, then verify them independently with a second calculation in the test. Do not capture the current displayed output as the sole source of truth. Invalid cases assert a validation category and visible message fragment instead of numeric results.

- [ ] **Step 4: Implement the browser fixture driver**

Launch Chromium, open `index.html` with `pathToFileURL`, clear browser storage, and dispatch each fixture through a module-specific adapter. Adapters fill controls and click existing calculation buttons. Parse numbers from result cards after stripping units and thousands separators.

Use this comparison helper:

```js
function close(actual, expected, tolerance, label) {
  assert.ok(Number.isFinite(actual), `${label}: finite result`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, received ${actual}`);
}
```

Keep selectors in an `adapters` object keyed by calculator ID so fixture data contains no CSS selectors.

- [ ] **Step 5: Verify red-green behavior**

Before completing each module adapter, run `corepack pnpm exec node tests/formula-regression.cjs` and confirm its first unimplemented case fails with the module/case ID. Implement only that adapter or fixture expectation, rerun to green, then proceed to the next module.

- [ ] **Step 6: Add the test to the browser group and run all tests**

Run: `corepack pnpm test`

Expected: every syntax, unit, existing browser, and new golden regression test passes.

- [ ] **Step 7: Commit the golden baseline**

```powershell
git add tests/fixtures/formula-cases.json tests/formula-regression.cjs scripts/run-tests.cjs README_开发维护说明.md
git commit -m "test: protect engineering calculations with golden cases"
```

---

### Task 3: Shared Import and Output Safety

**Files:**
- Create: `js/safety.js`
- Create: `tests/safety.cjs`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `js/calc-conductor.js`
- Modify: `js/calc-relay-fuse.js`
- Modify: `js/calc-bolt-suite.js`
- Modify: `js/calc-dfmea.js`
- Modify: `js/calc-dvpr.js`
- Modify: `js/calc-iec60664-system.js`
- Modify: `js/calc-schematic.js`
- Modify: `js/calc-sor-generator.js`
- Modify: `scripts/run-tests.cjs`

**Interfaces:**
- Produces: `window.ElectricalSafety` and CommonJS export with `escapeHtml`, `safeFilename`, `parseJson`, `validateImageDataUrl`, and `isPlainObject`.
- `parseJson(text, options)` accepts `maxBytes`, `maxDepth`, `maxArrayLength`, and `validate` and throws localized `Error` objects on rejection.
- `validateImageDataUrl(value, options)` returns the accepted string or throws.

- [ ] **Step 1: Write failing safety tests**

Create `tests/safety.cjs` that asserts:

```js
const assert = require('node:assert/strict');
const safety = require('../js/safety.js');

assert.equal(safety.escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
assert.equal(safety.safeFilename('PACK:A/B*?'), 'PACK_A_B__');
assert.deepEqual(safety.parseJson('{"rows":[1,2]}', {
  maxBytes: 64,
  maxDepth: 3,
  maxArrayLength: 5,
  validate: (value) => safety.isPlainObject(value) && Array.isArray(value.rows),
}), { rows: [1, 2] });
assert.throws(() => safety.parseJson('{"a":{"b":{"c":{"d":1}}}}', { maxBytes: 128, maxDepth: 3 }), /层级/);
assert.throws(() => safety.parseJson('{"rows":[1,2,3]}', { maxBytes: 128, maxArrayLength: 2 }), /条目/);
assert.throws(() => safety.validateImageDataUrl('data:text/html;base64,PGgxPg=='), /图片类型/);
assert.match(safety.validateImageDataUrl('data:image/png;base64,iVBORw0KGgo=', { maxBytes: 32 }), /^data:image\/png/);
console.log('PASS shared safety utilities');
```

- [ ] **Step 2: Run and verify the expected failure**

Run: `node tests/safety.cjs`

Expected: FAIL because `js/safety.js` does not exist.

- [ ] **Step 3: Implement the UMD-style safety utility**

Use one factory so the same implementation works through `require()` and `window.ElectricalSafety`. Count JSON bytes with `TextEncoder` when present and `Buffer.byteLength` under Node. Walk parsed values iteratively to enforce depth and array limits. Allow only `image/png`, `image/jpeg`, `image/webp`, and `image/gif`; calculate decoded Base64 size before accepting a data URL.

- [ ] **Step 4: Load safety before the framework**

Insert `<script src="js/safety.js?v=1.0"></script>` immediately before `js/app.js` in `index.html`. Change `app.js` utilities to delegate `escapeHtml` to `ElectricalSafety.escapeHtml` and expose it through `ElUtil` for backward compatibility.

- [ ] **Step 5: Harden JSON and image import boundaries one module at a time**

For every listed module, first extend its existing browser test with one malformed, oversized, or wrongly typed import that must leave current state unchanged. Then replace raw `JSON.parse(await file.text())` and ad hoc filename/image checks with `ElectricalSafety` calls. Use module-specific maximum collection sizes; use a 10 MiB default JSON limit and a 6 MiB decoded-image limit unless an existing valid fixture requires a smaller explicit bound.

Do not replace trusted static templates mechanically. Replace only user-controlled interpolation with `escapeHtml`, `textContent`, or element properties.

- [ ] **Step 6: Verify focused and full suites**

Run:

```powershell
node tests/safety.cjs
corepack pnpm test:browser
corepack pnpm test
```

Expected: all commands exit 0 and valid historical imports still round-trip.

- [ ] **Step 7: Commit the safety boundary**

```powershell
git add js/safety.js tests/safety.cjs index.html js/app.js js/calc-conductor.js js/calc-relay-fuse.js js/calc-bolt-suite.js js/calc-dfmea.js js/calc-dvpr.js js/calc-iec60664-system.js js/calc-schematic.js js/calc-sor-generator.js scripts/run-tests.cjs
git commit -m "security: validate local imports and user content"
```

---

### Task 4: Shared Browser Storage and Compatibility Migration

**Files:**
- Create: `js/storage.js`
- Create: `tests/storage.cjs`
- Modify: `index.html`
- Modify: `js/drafts.js`
- Modify: `js/app.js`
- Modify: `js/calc-materials.js`
- Modify: `js/calc-part-estimator.js`
- Modify: `js/calc-iec60664-system.js`
- Modify: `tests/drafts-and-report.cjs`
- Modify: `scripts/run-tests.cjs`

**Interfaces:**
- Produces: `window.ElectricalStorage` and CommonJS exports `createStorage(environment)` and `ERROR_CODES`.
- `readJson(key, options)` returns `{ ok, value, source, error }`.
- `writeJson(key, value)` and `remove(key)` return `{ ok, error }`.
- `readWithLegacy(currentKey, legacyKeys, options)` performs validation and lazy migration without deleting legacy values.
- `openObjectStore({ database, version, store, keyPath })` provides `ready`, `getAll()`, `put(value)`, and `remove(key)`.

- [ ] **Step 1: Write failing storage tests with an in-memory localStorage fake**

Cover successful round-trip, malformed JSON, quota failure, unavailable storage, validation rejection, successful legacy migration, failed migration preserving the legacy record, and monotonic draft timestamps.

The first test uses this contract:

```js
const assert = require('node:assert/strict');
const { createStorage, ERROR_CODES } = require('../js/storage.js');
const values = new Map();
const localStorage = {
  get length() { return values.size; },
  key: (index) => [...values.keys()][index] ?? null,
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const storage = createStorage({ localStorage });
assert.equal(storage.writeJson('sample', { value: 42 }).ok, true);
assert.deepEqual(storage.readJson('sample').value, { value: 42 });
values.set('broken', '{');
assert.equal(storage.readJson('broken').error.code, ERROR_CODES.MALFORMED);
```

- [ ] **Step 2: Run and verify the expected failure**

Run: `node tests/storage.cjs`

Expected: FAIL because `js/storage.js` does not exist.

- [ ] **Step 3: Implement storage without changing existing keys**

Implement the declared result objects and IndexedDB wrapper. Map DOM exceptions named `QuotaExceededError` to `quota`, malformed JSON to `malformed`, failed validation to `invalid`, unavailable APIs to `unavailable`, and migration exceptions to `migration`. Never delete or overwrite a legacy record until a validated current record has been written successfully.

- [ ] **Step 4: Load storage before app and drafts**

In `index.html`, load `js/safety.js`, then `js/storage.js`, then `js/app.js` and `js/drafts.js`. Keep all calculator script order unchanged.

- [ ] **Step 5: Migrate consumers with characterization tests first**

Use existing keys exactly:

- `electrical_toolkit_active_calculator_v1`
- `electrical_toolkit_draft_v1:` prefix
- `electrical_toolkit_part_estimator_v1`
- `electrical_toolkit_iec60664_verification_v1`
- existing material override and custom-material keys from `calc-materials.js`
- IndexedDB database `electrical-toolkit-drafts`, version 1, object store `drafts`

Before each consumer edit, add a test that seeds its current stored representation, reloads `index.html`, and confirms the value is restored. Then switch the consumer to `ElectricalStorage`. Preserve `window.CalculatorDrafts` and its existing method signatures.

- [ ] **Step 6: Add visible failure behavior**

Extend `tests/drafts-and-report.cjs` so a simulated failed localStorage and IndexedDB write keeps current form values and changes the draft status to the existing “浏览器保存失败” message. Materials, estimator, and IEC save paths must return or display an actionable export-backup message rather than swallowing the error.

- [ ] **Step 7: Run focused and full verification**

Run:

```powershell
node tests/storage.cjs
corepack pnpm exec node tests/drafts-and-report.cjs
corepack pnpm test
```

Expected: legacy restoration, failure preservation, and all regressions pass.

- [ ] **Step 8: Commit the storage facade**

```powershell
git add js/storage.js tests/storage.cjs index.html js/drafts.js js/app.js js/calc-materials.js js/calc-part-estimator.js js/calc-iec60664-system.js tests/drafts-and-report.cjs scripts/run-tests.cjs
git commit -m "refactor: unify browser storage handling"
```

---

### Task 5: Extract Schematic Model, Geometry, and Routing

**Files:**
- Create: `js/schematic/model.js`
- Create: `js/schematic/geometry.js`
- Create: `js/schematic/routing.js`
- Create: `tests/schematic-core.cjs`
- Modify: `js/calc-schematic.js`
- Modify: `index.html`
- Modify: `tests/schematic-layout.cjs`
- Modify: `tests/schematic-browser.cjs`
- Modify: `scripts/run-tests.cjs`

**Interfaces:**
- `window.ElectricalSchematic.model`: `normalize`, `createDemo`, `clone`, `createComponent`, `createConnector`, `createPin`, `createTarget`, `createJunction`, and `rotationValue`.
- `window.ElectricalSchematic.geometry`: `rotatePoint`, `componentMinimumSize`, `endpointPositions`, `snapCoordinate`, and collision/bounds helpers.
- `window.ElectricalSchematic.routing`: `routeBranch`, `buildBranches`, `splitBranchAt`, `findCrossings`, `labelPlacement`, and junction-binding helpers.
- All three files also export their namespace under CommonJS for pure Node tests.

- [ ] **Step 1: Add failing model and geometry characterization tests**

In `tests/schematic-core.cjs`, require the three new files and cover:

- normalizing a minimal historical project;
- preserving unknown user text while filling missing arrays and defaults;
- rotating one point through 0°, 90°, 180°, and 270°;
- calculating connector endpoints on each component side;
- generating deterministic orthogonal routes for horizontal, vertical, and obstructed cases;
- preserving explicit waypoints;
- detecting a crossing without converting a connected junction into a bridge.

Also add a browser assertion that exporting the default drawing before and after extraction yields the same normalized JSON after removing `exportedAt` and generated IDs.

- [ ] **Step 2: Run and verify the expected failure**

Run: `node tests/schematic-core.cjs`

Expected: FAIL because `js/schematic/model.js` does not exist.

- [ ] **Step 3: Extract the model layer without behavior changes**

Move the existing constructors, `demo()`, `normalize()`, cloning, rotation normalization, defaults, and ID helpers into `model.js`. Pass an ID generator and clock into factory functions so tests can be deterministic. Keep a compatibility adapter in `calc-schematic.js` during the extraction.

Run `node tests/schematic-core.cjs`, `corepack pnpm exec node tests/schematic-layout.cjs`, and `corepack pnpm exec node tests/schematic-browser.cjs` before continuing.

- [ ] **Step 4: Extract pure geometry**

Move coordinate transforms, minimum-size calculations, endpoint positioning, bounds, snapping, and collision helpers into `geometry.js`. Every function receives state or explicit dimensions; none reads `host`, `document`, or mutable module globals.

Run the same three focused tests and confirm green.

- [ ] **Step 5: Extract routing and junction logic**

Move branch construction, orthogonal routing, waypoint normalization, crossing detection, label placement, junction binding, and branch splitting into `routing.js`. DOM event handlers stay in `calc-schematic.js`; they call routing functions with plain objects and apply returned state changes.

- [ ] **Step 6: Add scripts in dependency order**

Immediately before `calc-schematic.js` in `index.html`, add:

```html
<script src="js/schematic/model.js?v=1.0"></script>
<script src="js/schematic/geometry.js?v=1.0"></script>
<script src="js/schematic/routing.js?v=1.0"></script>
```

- [ ] **Step 7: Verify the extraction**

Run:

```powershell
node tests/schematic-core.cjs
corepack pnpm exec node tests/schematic-layout.cjs
corepack pnpm exec node tests/schematic-browser.cjs
corepack pnpm exec node tests/schematic-print-layout.cjs
corepack pnpm test
```

Expected: all tests pass and default-project normalized exports match.

- [ ] **Step 8: Commit the pure schematic core**

```powershell
git add js/schematic/model.js js/schematic/geometry.js js/schematic/routing.js js/calc-schematic.js index.html tests/schematic-core.cjs tests/schematic-layout.cjs tests/schematic-browser.cjs scripts/run-tests.cjs
git commit -m "refactor: extract schematic model and routing core"
```

---

### Task 6: Extract Schematic SVG, I/O, and Interaction Controllers

**Files:**
- Create: `js/schematic/svg.js`
- Create: `js/schematic/io.js`
- Create: `js/schematic/interactions.js`
- Modify: `js/calc-schematic.js`
- Modify: `index.html`
- Modify: `tests/schematic-core.cjs`
- Modify: `tests/schematic-browser.cjs`
- Modify: `tests/schematic-print-layout.cjs`

**Interfaces:**
- `svg.createRenderer(dependencies)` returns `diagramSvg(state, options)`, `componentSvg(component, context)`, `wireSvg(branch, context)`, and `printSvg(state)`.
- `io.createController(dependencies)` returns `importJson(file)`, `exportJson()`, `exportSvg()`, and `exportPdf()`.
- `interactions.createController(dependencies)` returns `bind()`, `unbind()`, `selectComponent(id)`, `selectPin(key)`, and pointer/keyboard handlers.
- `calc-schematic.js` owns current state and host, composes controllers, renders editors, and registers the calculator.

- [ ] **Step 1: Extend tests before extraction**

Add assertions that:

- repeated rendering of the same normalized state produces byte-identical SVG;
- user-authored component, connector, pin, wire, and revision text is escaped in SVG;
- invalid JSON does not replace the current state;
- valid historical JSON still imports and exports;
- binding and unbinding interactions does not accumulate document-level pointer or keyboard listeners;
- PDF preparation contains one SVG and restores the original DOM after `afterprint`.

Run the new assertions against the current monolith. They must pass as characterization tests or expose a failing security test whose fix belongs to Task 3.

- [ ] **Step 2: Extract deterministic SVG generation**

Move SVG-only formatting and markup functions to `svg.js`. Inject model, geometry, routing, and safety dependencies. Do not allow the renderer to query the editor DOM. Keep dynamic workspace CSS generation outside SVG unless it is required by exported markup.

- [ ] **Step 3: Extract import and export operations**

Move file parsing, downloads, filename creation, SVG export, and print preparation to `io.js`. Inject `getState`, `setState`, `render`, `validateForOutput`, and `getHost`. Use `ElectricalSafety.parseJson` and `safeFilename`; a failed import must retain the prior state.

- [ ] **Step 4: Extract interaction lifecycle**

Move canvas pointer, drag, resize, selection, nudge, pan, zoom, and document-listener lifecycle into `interactions.js`. `bind()` must be idempotent; `unbind()` must remove every document/window listener added by the controller. Keep editor form delegation in `calc-schematic.js`.

- [ ] **Step 5: Load the new files in dependency order**

Add after `routing.js` and before `calc-schematic.js`:

```html
<script src="js/schematic/svg.js?v=1.0"></script>
<script src="js/schematic/io.js?v=1.0"></script>
<script src="js/schematic/interactions.js?v=1.0"></script>
```

- [ ] **Step 6: Verify each extraction and final monolith reduction**

After each file extraction, run the three schematic browser tests. At the end, run `corepack pnpm test` and confirm `calc-schematic.js` contains orchestration/UI code rather than duplicate implementations of the extracted APIs.

- [ ] **Step 7: Commit the controller split**

```powershell
git add js/schematic/svg.js js/schematic/io.js js/schematic/interactions.js js/calc-schematic.js index.html tests/schematic-core.cjs tests/schematic-browser.cjs tests/schematic-print-layout.cjs
git commit -m "refactor: split schematic rendering and interactions"
```

---

### Task 7: Documentation, Offline Verification, and Final Audit

**Files:**
- Modify: `代码审查与架构说明.md`
- Modify: `README_开发维护说明.md`
- Modify: `README_本地使用说明.txt`
- Modify: `发布维护说明.md`
- Modify: `index.html` only if versioned script references need final synchronization

**Interfaces:**
- Produces: documentation that distinguishes zero-install end-user operation from optional contributor tooling.
- Verifies: offline `file://` loading, complete calculator registration, persistence compatibility, test reproducibility, and clean publication contents.

- [ ] **Step 1: Add a failing resource-integrity check**

Create a small assertion in the test runner or a dedicated `tests/resource-integrity.cjs` that parses `index.html`, resolves every local `script[src]` and `link[href]` after removing query strings, and fails if a referenced file is missing. Assert that at least twenty calculator registrations are present after page load and that no HTTP(S) asset is required.

- [ ] **Step 2: Run and verify the check before documentation edits**

Run: `corepack pnpm exec node tests/resource-integrity.cjs`

Expected: either PASS immediately as a characterization check or FAIL with the exact missing/locality issue to correct.

- [ ] **Step 3: Refresh all architecture and maintenance documentation**

Document the v2.0.0 entry point, test commands, dependency installation, storage facade, safety boundary, schematic file map, script order, legacy-data guarantees, and Cloudflare's unchanged no-build configuration. State explicitly that users do not need pnpm, Node.js, Playwright, or a server.

- [ ] **Step 4: Perform full fresh verification**

Run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm test
git diff --check
git status --short
```

Then open `index.html` through Playwright using `file://`, wait for `CalculatorDrafts.ready`, enumerate `ElectricalToolkit.list()`, open every registered calculator, collect `pageerror` and console error events, and confirm no network request is required for local assets.

- [ ] **Step 5: Audit published contents and backward compatibility**

Confirm Git does not track `node_modules`, browser binaries, Playwright reports, test results, credentials, or temporary files. Import representative historical JSON fixtures for drafts, IEC, estimator, bolt, DFMEA, DVP&R, SOR, and schematic modules and verify their state survives an export/import round trip.

- [ ] **Step 6: Commit documentation and final integrity checks**

```powershell
git add 代码审查与架构说明.md README_开发维护说明.md README_本地使用说明.txt 发布维护说明.md tests/resource-integrity.cjs scripts/run-tests.cjs index.html
git commit -m "docs: document hardened offline architecture"
```

- [ ] **Step 7: Review the complete branch without pushing**

Run:

```powershell
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git status --short --branch
```

Present the commits, test totals, any intentionally deferred risks, and the unchanged Cloudflare deployment configuration to the user. Do not push until explicitly requested.
