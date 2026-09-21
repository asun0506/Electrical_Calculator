# Schematic Editing Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a legend note, confirmed wire deletion, movable/resizable drawing frames, compact components with global label sizes, and image-matched twisted-pair marking with popover-controlled color order.

**Architecture:** Extend the existing schematic model and pure geometry helpers first, then wire the SVG and DOM controls in `calc-schematic.js`. Keep new fields optional in normalized legacy drawings so the current default JSON export does not acquire unrelated keys. Reuse the existing pointer/undo machinery and import safety validator; do not extract a new controller subsystem.

**Tech Stack:** Plain HTML/SVG/CSS and classic JavaScript, Node.js `assert`, Playwright Chromium under `file://`, `pnpm test`.

**Spec:** `docs/superpowers/specs/2026-09-21-schematic-editing-design.md`

## Global Constraints

- No backend, runtime framework, bundler, or new runtime dependency; double-clicking `index.html` remains supported offline.
- Legacy drawings without new fields retain their existing appearance and calculated frame positions.
- `meta.legendNote` is one line, at most 200 characters, and escaped in every output.
- `colorOrderSwapped` is connection-local, optional, and defaults to false; line click still opens the popover and does not change color.
- Frame geometry uses flat `titleBlockX/Y/W/H` and `revisionBlockX/Y/W/H` metadata; title minimum is 280×64, revision minimum is 280×`max(54,18+18×displayedRows)`.
- Empty ordinary components/containers may shrink to `5×gridSize` by `2×gridSize`; content-driven minima remain in force.
- Component title size is bounded 8–32 px and Pin label size 6–20 px; legacy defaults render as 22 px and 8 px.
- No GitHub push or deployment in this plan; implementation is local unless separately requested.

## Review Focus

1. Imported `legendNote` with SVG metacharacters remains inert and round-trips without losing text (Task 1/2 tests).
2. Cancelled deletion of a parent wire with junction children changes neither state nor undo history (Task 3 test).
3. Swapping one of two CAN connection records does not swap the other, and neither click nor drag toggles colors (Task 3 test).
4. A moved frame resized near a sheet edge remains inside the paper after changing paper size or re-importing JSON (Task 4 test).
5. A 50×20 empty component can be resized, while a Pin-bearing component never places a Pin outside its boundary (Task 5 test).

## File map

- `js/schematic/model.js`: normalize the new optional fields and keep legacy defaults stable.
- `js/schematic/geometry.js`: frame geometry/clamping and content-aware component minima; no DOM.
- `js/calc-schematic.js`: existing UI controls, SVG, pointer actions, export/import validation.
- `tests/schematic-core.cjs`: pure model and geometry cases.
- `tests/schematic-wire-editor.cjs`: real canvas click, popover, export/import, and deletion behavior.
- `tests/schematic-layout.cjs`: frame dragging/resizing, component sizing, and font control browser behavior.
- `tests/schematic-browser.cjs`: existing export and legacy JSON baselines.

---

### Task 1: Safe optional drawing metadata

**Files:**
- Modify: `js/schematic/model.js:66-73`
- Modify: `js/calc-schematic.js:345-363`
- Test: `tests/schematic-core.cjs`
- Test: `tests/schematic-wire-editor.cjs`

**Interfaces:**
- Consumes: current `normalize(s, context)` and `validImport(data)`.
- Produces: optional `meta.legendNote`, `meta.componentNameFontSize`, `meta.pinNameFontSize`, `meta.titleBlockX/Y/W/H`, `meta.revisionBlockX/Y/W/H`; optional `connection.colorOrderSwapped`.

- [ ] **Step 1: Write RED model and real-import cases.** Add assertions to `schematic-core.cjs` for a legacy drawing with no new serialized keys, valid round trip of each new field, and clamping of font values. In `schematic-wire-editor.cjs`, add a helper that uploads JSON through `#schImport` and proves an invalid nested frame object or non-boolean `colorOrderSwapped` preserves the current drawing. Example core assertion:

```js
const enriched = model.normalize({
  meta: { legendNote: '<tag>', componentNameFontSize: 17, pinNameFontSize: 11, titleBlockX: 300 },
  components: [], connections: [{ id: 'can-1', type: 'can', colorOrderSwapped: true, targets: [] }]
}, context());
assert.equal(enriched.meta.legendNote, '<tag>');
assert.equal(enriched.meta.componentNameFontSize, 17);
assert.equal(enriched.connections[0].colorOrderSwapped, true);
assert.equal(Object.hasOwn(model.normalize({ components: [] }, context()).meta, 'legendNote'), false);
```

- [ ] **Step 2: Run RED.** `node tests/schematic-core.cjs` and `node tests/schematic-wire-editor.cjs` must fail on absent fields/validation behavior, not browser startup.
- [ ] **Step 3: Implement explicit normalization and import validation.** In `normalize`, copy `legendNote` only when supplied (truncate at 200; replace CR/LF with spaces), clamp optional font sizes to `[8,32]` and `[6,20]`, retain finite optional frame numbers, and copy `colorOrderSwapped` only as a boolean. In `validImport`, add the eight frame keys to the numeric key set, additionally bound their values to paper-scale finite numbers, require `legendNote` to be a string of at most 200 characters, font sizes to be finite numbers in range, and `colorOrderSwapped` to be boolean. Reject a failed field before assigning `state=next`; leave all other object fields under the existing `record` policy.

```js
const boundedNumber = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const validMeta = value => record(value, ['legendLabels']) &&
  (value.legendNote == null || (typeof value.legendNote === 'string' && value.legendNote.length <= 200)) &&
  (value.componentNameFontSize == null || boundedNumber(value.componentNameFontSize, 8, 32)) &&
  (value.pinNameFontSize == null || boundedNumber(value.pinNameFontSize, 6, 20)) &&
  ['titleBlockX','titleBlockY','titleBlockW','titleBlockH',
   'revisionBlockX','revisionBlockY','revisionBlockW','revisionBlockH']
    .every(key => value[key] == null || boundedNumber(value[key], 0, 10000));
const validWire = value => record(value, ['targets']) &&
  (value.colorOrderSwapped == null || typeof value.colorOrderSwapped === 'boolean') &&
  list(value.targets, 200, target);
```

- [ ] **Step 4: Run GREEN and regression.** `node tests/schematic-core.cjs`, `node tests/schematic-wire-editor.cjs`, and `node tests/schematic-browser.cjs` exit 0. If the existing default JSON hash changes, fix optional-field serialization rather than rewriting the baseline.
- [ ] **Step 5: Commit.** Stage only the four intended files and commit `feat: normalize schematic editing settings`.

### Task 2: Legend note and paired-line symbol

**Files:**
- Modify: `js/calc-schematic.js:223-225,258-286`
- Test: `tests/schematic-wire-editor.cjs`
- Test: `tests/schematic-browser.cjs`

**Interfaces:**
- Consumes: `meta.legendNote` from Task 1 and current `legend()`, `twistMarksPair()`.
- Produces: `twistSymbol(cx, top, bottom, vertical=false) -> SVG path markup` shared by legend and wire drawing; `data-legend-note` input.

- [ ] **Step 1: Write RED browser assertions.** Open `.sch-legend`, fill `[data-legend-note]` with `A&B <test>`, assert one escaped note below existing entries in canvas and exported SVG, then download JSON and upload it via `#schImport`; verify the exact note returns. Assert the note is absent on a legacy draft. Inspect `.sch-legend [data-twist-symbol]` and `.sch-wire-twisted [data-twist-symbol]` for the same marker shape; include a vertical route fixture and assert its marker is rotated.

```js
await page.locator('.sch-legend-hit').click();
await page.locator('[data-legend-note]').fill('A&B <test>');
assert.match(await page.locator('.sch-legend').textContent(), /A&B <test>/);
assert.match(await page.locator('#schDiagram').evaluate(el => el.outerHTML), /A&amp;B &lt;test&gt;/);
```

- [ ] **Step 2: Run RED.** `node tests/schematic-wire-editor.cjs` fails because the note input/marker data attribute is absent.
- [ ] **Step 3: Implement the note and symbol.** Add a one-line input under the legend label grid; input updates `meta.legendNote`, calls `draw()`, and is capped at 200 characters. Increase legend hit rectangle height only when note is present; use escaped SVG text at the next baseline. Extract the image-matched marker path into `twistSymbol`: a crossing stroke across both cores plus top-right and bottom-left short diagonals, rotated for vertical runs; call it from both the CAN legend entry and `twistMarksPair`. Keep hit areas and default line colors unchanged.

```js
function twistSymbol(mid, first, second, vertical=false) {
  const half = (first + second) / 2;
  return vertical
    ? `<path data-twist-symbol="vertical" class="sch-twist-mark" d="M${first} ${mid}H${second} M${first} ${mid}l-4 -2 M${second} ${mid}l4 2"/>`
    : `<path data-twist-symbol="horizontal" class="sch-twist-mark" d="M${mid} ${first-6}V${second+6} M${mid} ${first-6}l5 3 M${mid} ${second+6}l-5 -3"/>`;
}
```

- [ ] **Step 4: Run GREEN.** `node tests/schematic-wire-editor.cjs` and `node tests/schematic-browser.cjs` pass; inspect downloaded SVG at two scales so the symbol resembles the supplied reference and does not become the former split zigzag.
- [ ] **Step 5: Commit.** Commit `feat: add schematic legend note and pair marker`.

### Task 3: Wire popover deletion and CAN color order

**Files:**
- Modify: `js/calc-schematic.js:214-225,259`
- Test: `tests/schematic-wire-editor.cjs`

**Interfaces:**
- Consumes: `connection.colorOrderSwapped` from Task 1, existing `connectionGroupWires(w)`, `pushUndo()`, `render()`, `openWireInspector()`.
- Produces: `deleteConnectionGroup(w) -> boolean` shared by popover and workspace; CAN popover button `[data-swap-wire-colors]`.

- [ ] **Step 1: Write RED browser cases.** Use a fixture with a parent wire, one junction child, an unrelated sibling, and two independent CAN connections. Click a CAN segment (real pointer event) and assert the popover appears without color change. Click `[data-swap-wire-colors]`, assert only its `.sch-can-high/.sch-can-low` stroke colors reverse and JSON retains `colorOrderSwapped`. Simulate cancel and accept of deletion dialogs separately; parent deletion removes its descendant but not sibling, child deletion leaves parent, Pin data, and components. Assert Undo restores the confirmed deletion and cancel leaves the snapshot count unchanged.

```js
const before = await page.locator('[data-wire-branch="can-a:target-a"] .sch-can-high').getAttribute('stroke');
await page.locator('[data-wire-inspector="can-a"] [data-swap-wire-colors]').click();
const after = await page.locator('[data-wire-branch="can-a:target-a"] .sch-can-high').getAttribute('stroke');
assert.notEqual(after, before);
```

- [ ] **Step 2: Run RED.** `node tests/schematic-wire-editor.cjs` fails on the missing buttons.
- [ ] **Step 3: Implement shared actions.** Render a danger-button footer in the wire inspector and a swap button only for `type==='can'`. Exclude delete buttons from `beginUndoOperation` so pointerdown does not create an undo entry before confirmation. `deleteConnectionGroup` computes IDs from `connectionGroupWires`, asks `confirm()` before mutation, calls `pushUndo()` only after confirmation, filters `state.connections`, closes inspector, and `render()`s. Replace the workspace delete branch with that helper. The swap button calls `pushUndo()`, toggles the boolean, updates button state and calls `draw()`; `wireSvg()` selects primary/pair stroke colors from the flag without swapping endpoint routes or legend defaults.

```js
function deleteConnectionGroup(w) {
  const ids = new Set(connectionGroupWires(w).map(item => item.id));
  if (!confirm(`确定删除这条线路及其关联分支（共 ${ids.size} 条）吗？`)) return false;
  pushUndo();
  state.connections = state.connections.filter(item => !ids.has(item.id));
  closeInspector();
  render();
  return true;
}
```

- [ ] **Step 4: Run GREEN.** `node tests/schematic-wire-editor.cjs`, `node tests/schematic-browser.cjs`, and `node tests/schematic-core.cjs` pass. Verify clicking outside the popover or dragging a segment never toggles colors.
- [ ] **Step 5: Commit.** Commit `feat: confirm wire deletion and swap pair colors`.

### Task 4: Movable and resizable drawing frames

**Files:**
- Modify: `js/schematic/geometry.js:21-48`
- Modify: `js/calc-schematic.js:266-289,320-336`
- Test: `tests/schematic-core.cjs`
- Test: `tests/schematic-layout.cjs`

**Interfaces:**
- Consumes: optional frame metadata from Task 1, `canvasDimensions(state)`, `snapClamp`.
- Produces: `drawingFrame(state, kind) -> {x,y,w,h}` and `clampDrawingFrame(state, kind, rectangle) -> rectangle` in `ElectricalSchematic.geometry`.

- [ ] **Step 1: Write RED pure and browser cases.** Assert legacy frame defaults for A3, custom values after normalization, title min 280×64, revision min based on four visible rows, and clamping after a sheet-size change. In Playwright, drag each frame separately, resize using `[data-resize-frame="title"]` / `revision`, assert frame SVG rect geometry changes, and compare SVG export to the canvas minus editing handles. Include a long revision description to prove the source text survives resize and JSON round trip.

```js
const old = geometry.drawingFrame(model.createDemo(context()), 'title');
assert.deepEqual(old, { x: geometry.canvasDimensions(model.createDemo(context())).w - 360,
  y: geometry.canvasDimensions(model.createDemo(context())).h - 82, w: 342, h: 64 });
```

- [ ] **Step 2: Run RED.** `node tests/schematic-core.cjs` fails on the missing geometry function; `node tests/schematic-layout.cjs` fails on missing frame handles.
- [ ] **Step 3: Implement pure frame geometry.** Compute defaults from sheet dimensions and `state.revisions.slice(-4).length`; merge optional metadata; clamp to sheet with a 12-pixel margin and the size minima. Return a new rectangle, never mutate the input. Use metadata keys `titleBlockX/Y/W/H` or `revisionBlockX/Y/W/H` based on `kind`.

```js
function drawingFrame(state, kind) {
  const paper = canvasDimensions(state), rows = Math.min(4, state.revisions?.length || 0);
  const defaults = kind === 'title'
    ? { x: paper.w - 360, y: paper.h - 82, w: 342, h: 64 }
    : { x: paper.w - 360, y: 24, w: 342, h: Math.max(54, 18 + rows * 18) };
  const prefix = kind === 'title' ? 'titleBlock' : 'revisionBlock';
  const savedFields = {};
  for (const field of ['x','y','w','h']) {
    const raw = state.meta?.[prefix + field.toUpperCase()];
    if (Number.isFinite(raw)) savedFields[field] = raw;
  }
  return clampDrawingFrame(state, kind, { ...defaults, ...savedFields });
}
```

- [ ] **Step 4: Wire frame SVG and pointer interactions.** Make frame column offsets proportions of `w`, row spacing respect `h`, visually ellipsize overlong SVG text without touching state, and emit edit-only background hit rectangles/resize handles. In `startInteraction`, recognize frame resize before frame move; in `moveInteraction`, use paper-scaled `dx/dy`, grid snap and Alt bypass; write only that frame's four metadata fields on actual movement. Exclude frame hit areas from generic pointerdown undo and call `pushUndo()` on first >3-pixel drag movement, then suppress post-drag clicks. Use `data-move-frame="title|revision"` and `data-resize-frame="title|revision"` so pointer dispatch is unambiguous.

```js
const frameHandle = e.target.closest('[data-resize-frame],[data-move-frame]');
if (frameHandle) {
  const kind = frameHandle.dataset.resizeFrame || frameHandle.dataset.moveFrame;
  interaction = { mode: frameHandle.dataset.resizeFrame ? 'frame-resize' : 'frame-move',
    kind, original: G.drawingFrame(state, kind), startX: e.clientX, startY: e.clientY,
    sx: paper.w / rect.width, sy: paper.h / rect.height, moved: false, activated: false };
  registerInteraction();
  e.preventDefault();
  return;
}
```
- [ ] **Step 5: Run GREEN.** `node tests/schematic-core.cjs`, `node tests/schematic-layout.cjs`, `node tests/schematic-browser.cjs` pass. Export SVG, inspect frame placement and verify no handles exist in export.
- [ ] **Step 6: Commit.** Commit `feat: move and resize schematic drawing frames`.

### Task 5: Compact components and global label sizes

**Files:**
- Modify: `js/schematic/geometry.js:13-43`
- Modify: `js/calc-schematic.js:100-103,249-253,273-275,329-336`
- Test: `tests/schematic-core.cjs`
- Test: `tests/schematic-layout.cjs`

**Interfaces:**
- Consumes: optional `meta.componentNameFontSize` / `meta.pinNameFontSize` from Task 1.
- Produces: `componentMinimumSize(component, gridSize=10) -> {w,h}`; drawing-level font controls; outside-name flag/class in SVG.

- [ ] **Step 1: Write RED cases.** Assert `componentMinimumSize(empty,10)` equals `{w:50,h:20}`; test 5- and 20-pixel grids; confirm a placed multi-Pin connector and embedded device raise minima; assert `connectorPosition()` stays within the resulting box. In the browser, set component and Pin font controls, inspect SVG font size in canvas and export, and assert a long name or narrow 50×20 box places the component title below the box rather than overlapping the Pin labels.

```js
const empty = { type: 'component', connectors: [], devices: [] };
assert.deepEqual(geometry.componentMinimumSize(empty, 10), { w: 50, h: 20 });
assert.deepEqual(geometry.componentMinimumSize(empty, 20), { w: 100, h: 40 });
```

- [ ] **Step 2: Run RED.** `node tests/schematic-core.cjs` fails on the old 100×60 minimum; `node tests/schematic-layout.cjs` fails on absent font controls/outside title.
- [ ] **Step 3: Implement content-aware minima and Pin placement.** Pass `gridStep(state)` through existing component-minimum callers. Replace only the ordinary-component 100×60 base floor with `5*gridSize` and `2*gridSize`; retain connector-span and embedded-device floors, lowering fixed padding only for genuinely empty sides. For a small Pin-bearing component, calculate pin coordinates from the actual usable edge and clamp them inside the rectangle. Leave standalone devices and junctions unchanged.

```js
const baseW = 5 * gridSize, baseH = 2 * gridSize;
const hasPlacedPins = c.connectors.some(k => connectorIsPlaced(k) && k.pins.length);
return {
  w: Math.max(baseW, horizontal ? horizontal + 40 : 0, deviceW + (c.devices.length ? 20 : 0), hasPlacedPins ? 40 : 0),
  h: Math.max(baseH, vertical ? vertical + 50 : 0, deviceH + (c.devices.length ? 20 : 0), hasPlacedPins ? 40 : 0)
};
```
- [ ] **Step 4: Implement typography controls and outside title.** Add two numeric drawing-level inputs (`data-meta-number`) with the specified min/max/defaults. Update state on input and redraw; write bounded inline/CSS-variable SVG sizes for `.sch-component-title` and `.sch-pin text`, with the compact title scaled below the selected regular size. Measure the title with canvas/SVG text metrics or a conservative character-width fallback; if it cannot fit within `c.w-16` or `c.h` is too short, place centered below `c.y+c.h` with a white paint-order halo. Use the same SVG path for canvas and export.

```js
const titleSize = state.meta.componentNameFontSize ?? 22;
const pinSize = state.meta.pinNameFontSize ?? 8;
const outside = estimatedTextWidth(c.name, titleSize) > c.w - 16 || c.h < titleSize + 12;
const titleY = outside ? c.y + c.h + titleSize + 4 : c.y + Math.min(c.h - 4, titleSize + 6);
```

- [ ] **Step 5: Run GREEN.** `node tests/schematic-core.cjs`, `node tests/schematic-layout.cjs`, and `node tests/schematic-browser.cjs` pass. Visually inspect an empty 50×20 part, a Pin-rich part, and a long external title at A3 and A1.
- [ ] **Step 6: Commit.** Commit `feat: support compact schematic components and fonts`.

### Task 6: Whole-feature verification and cleanup

**Files:**
- Modify only tests/source files needed to resolve failures from this plan; do not add unrelated refactors.

**Interfaces:**
- Consumes: Tasks 1–5 committed behavior.
- Produces: clean local branch and reproducible verification evidence.

- [ ] **Step 1: Run the full suite.** `pnpm test`; read exit code and all failures. Fix any failure with a new RED regression assertion before modifying product code, then rerun focused and full tests.
- [ ] **Step 2: Visual QA.** Open `index.html` under `file://` with the repo Playwright/Chromium setup. Capture/check the legend note, wire popover, paired marker, narrow component, and both frame handles; compare exported SVG/PDF to canvas and ensure handles are absent in output.
- [ ] **Step 3: Validate compatibility and tree.** Verify a legacy drawing with no new keys loads; valid new JSON re-imports; hostile values do not replace current state; `git diff --check` is clean. Restore only exact tracked PDF files regenerated by tests and remove only known new test artifacts after identifying their paths; preserve user changes.
- [ ] **Step 4: Review and handoff.** Perform a whole-branch code review, address Critical/Important findings with tests, rerun `pnpm test`, then report commit IDs, test evidence, and any deferred minor issues. Do not push without a new request.
