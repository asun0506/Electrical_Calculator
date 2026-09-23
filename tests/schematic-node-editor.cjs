const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
let browser;

(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 } });
  let acceptDialog = true;
  page.on('dialog', dialog => acceptDialog ? dialog.accept() : dialog.dismiss());
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => ElectricalToolkit.open('schematic'));
  await page.waitForSelector('#schDiagram');

  await page.evaluate(() => ElectricalToolkit.get('schematic').restoreDraft({
    meta: { title: 'node-editor', snapToGrid: true, gridSize: 10 },
    components: [
      { id: 'device', name: 'Shunt', type: 'device', symbolType: 'shunt', x: 200, y: 100, w: 104, h: 76, rotation: 0, connectors: [{ id: 'device-bottom', name: 'Sense', side: 'bottom', pins: [{ id: 'device-pin', no: '1', definition: 'SENSE' }] }], devices: [] },
      { id: 'device-target', name: 'Device target', type: 'component', x: 200, y: 400, w: 160, h: 100, connectors: [{ id: 'device-target-top', name: 'J1', side: 'top', pins: [{ id: 'device-target-pin', no: '1', definition: 'SENSE' }] }], devices: [] },
      { id: 'source', name: 'Source', type: 'component', x: 50, y: 220, w: 140, h: 100, connectors: [{ id: 'source-right', name: 'J1', side: 'right', pins: [{ id: 'source-pin', no: '1', definition: 'SIG' }] }], devices: [] },
      { id: 'target', name: 'Target', type: 'component', x: 850, y: 220, w: 140, h: 100, connectors: [{ id: 'target-left', name: 'J1', side: 'left', pins: [{ id: 'target-pin', no: '1', definition: 'SIG' }] }], devices: [] },
      { id: 'junction-one', name: 'J1', type: 'junction', x: 430, y: 270, w: 20, h: 20, color: '#546e7a', connectors: [{ id: 'junction-one-connector', name: '中间点', side: 'right', pins: [{ id: 'junction-one-pin', no: '1', definition: 'NODE' }] }], devices: [] },
      { id: 'branch-target', name: 'Branch target', type: 'component', x: 400, y: 500, w: 160, h: 100, connectors: [{ id: 'branch-target-top', name: 'J1', side: 'top', pins: [{ id: 'branch-target-pin', no: '1', definition: 'BRANCH' }] }], devices: [] },
      { id: 'junction-two', name: 'J2', type: 'junction', x: 430, y: 410, w: 20, h: 20, color: '#546e7a', connectors: [{ id: 'junction-two-connector', name: '中间点', side: 'right', pins: [{ id: 'junction-two-pin', no: '1', definition: 'NODE' }] }], devices: [] },
      { id: 'leaf-target', name: 'Leaf target', type: 'component', x: 650, y: 500, w: 160, h: 100, connectors: [{ id: 'leaf-target-top', name: 'J1', side: 'top', pins: [{ id: 'leaf-target-pin', no: '1', definition: 'LEAF' }] }], devices: [] },
    ],
    connections: [
      { id: 'device-wire', from: 'pin:device-pin', type: 'lv', gauge: '', net: 'SENSE', function: '', targets: [{ id: 'device-wire-target', to: 'pin:device-target-pin', waypoints: [] }] },
      { id: 'trunk', from: 'pin:source-pin', type: 'lv', gauge: '0.5 mm²', net: 'SIG', function: '', targets: [{ id: 'trunk-target', to: 'pin:target-pin', waypoints: [{ x: 430, y: 270, junctionId: 'junction-one' }] }] },
      { id: 'branch', from: 'pin:junction-one-pin', type: 'lv', gauge: '0.5 mm²', net: 'SIG', function: '', parentWireId: 'trunk', parentTargetId: 'trunk-target', parentJunctionId: 'junction-one', targets: [{ id: 'branch-target-id', to: 'pin:branch-target-pin', waypoints: [{ x: 430, y: 410, junctionId: 'junction-two' }] }] },
      { id: 'leaf', from: 'pin:junction-two-pin', type: 'lv', gauge: '0.5 mm²', net: 'SIG', function: '', parentWireId: 'branch', parentTargetId: 'branch-target-id', parentJunctionId: 'junction-two', targets: [{ id: 'leaf-target-id', to: 'pin:leaf-target-pin', waypoints: [] }] },
    ],
    revisions: [],
  }));

  const devicePin = page.locator('[data-endpoint-key="pin:device-pin"] circle');
  const beforePin = await devicePin.evaluate(el => ({ x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy')) }));
  const deviceWire = page.locator('[data-wire-branch="device-wire:device-wire-target"] path').first();
  const beforeWire = await deviceWire.getAttribute('d');
  await devicePin.dispatchEvent('pointerdown');
  await devicePin.dispatchEvent('pointerup');
  assert.equal(await page.locator('[data-endpoint-key="pin:device-pin"]').evaluate(el => el.classList.contains('sch-pin-selected')), true, 'standalone-device Pin becomes selected');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  const afterPin = await devicePin.evaluate(el => ({ x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy')) }));
  assert.deepEqual(afterPin, { x: beforePin.x + 11, y: beforePin.y }, 'bottom Pin moves only along the displayed edge');
  assert.notEqual(await deviceWire.getAttribute('d'), beforeWire, 'connected wire follows the moved Pin');
  const movedDraft = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  assert.equal(movedDraft.components.find(c => c.id === 'device').connectors[0].pins[0].offset, 11);
  await page.evaluate(draft => ElectricalToolkit.get('schematic').restoreDraft(draft), movedDraft);
  assert.deepEqual(await devicePin.evaluate(el => ({ x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy')) })), afterPin, 'Pin offset survives restore');

  await page.locator('[data-endpoint-key="pin:junction-one-pin"] circle').click();
  const inspector = page.locator('[data-junction-inspector="junction-one"]');
  await inspector.waitFor();
  assert.equal(await inspector.getAttribute('aria-label'), '中间点属性');
  await inspector.locator('[data-inspector-junction-field="name"]').fill('Branch J1');
  await inspector.locator('[data-inspector-junction-field="x"]').fill('470');
  await inspector.locator('[data-inspector-junction-field="color"]').fill('#c2410c');
  assert.equal(await page.locator('[data-component-editor="junction-one"] [data-component-field="name"]').inputValue(), 'Branch J1', 'name synchronizes to workspace');
  assert.equal(await page.locator('[data-component-editor="junction-one"] [data-component-field="x"]').inputValue(), '470', 'position synchronizes to workspace');
  assert.equal(await page.locator('[data-component-editor="junction-one"] input[type="color"][data-component-field="color"]').inputValue(), '#c2410c', 'color synchronizes to workspace');
  const edited = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  assert.equal(edited.connections.find(w => w.id === 'trunk').targets[0].waypoints.find(p => p.junctionId === 'junction-one').x, 470, 'trunk anchor follows edited position');
  await page.locator('[data-component-editor="junction-one"] [data-component-field="name"]').fill('Workspace J1');
  assert.equal(await inspector.locator('[data-inspector-junction-field="name"]').inputValue(), 'Workspace J1', 'workspace changes synchronize back to the inspector');
  await page.locator('[data-drag-component="junction-one"] .sch-junction-hit').evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.right - 1, y = r.top + r.height / 2;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x + 20, clientY: y + 10 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x + 20, clientY: y + 10 }));
  });
  const dragged = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().components.find(c => c.id === 'junction-one'));
  assert.equal(await inspector.locator('[data-inspector-junction-field="x"]').inputValue(), String(dragged.x), 'dragged X synchronizes to the open inspector');
  assert.equal(await inspector.locator('[data-inspector-junction-field="y"]').inputValue(), String(dragged.y), 'dragged Y synchronizes to the open inspector');
  if (process.env.SCHEMATIC_NODE_SCREENSHOT) await page.screenshot({ path: process.env.SCHEMATIC_NODE_SCREENSHOT, fullPage: true });

  acceptDialog = false;
  await inspector.locator('[data-delete-junction-inspector]').click();
  assert.ok((await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft())).components.some(c => c.id === 'junction-one'), 'cancel keeps the junction');
  acceptDialog = true;
  await inspector.locator('[data-delete-junction-inspector]').click();
  const deleted = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  assert.deepEqual(deleted.connections.map(w => w.id).sort(), ['device-wire', 'trunk'], 'trunk remains while junction branches and descendants are removed');
  assert.ok(deleted.components.every(c => c.id !== 'junction-one' && c.id !== 'junction-two'), 'dependent junction nodes are removed with their branches');
  assert.ok(deleted.connections.find(w => w.id === 'trunk').targets[0].waypoints.every(p => !p.junctionId), 'trunk keeps its route without deleted junction anchors');
  await page.locator('#schUndo').click();
  const restored = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  assert.ok(restored.components.some(c => c.id === 'junction-one'));
  assert.ok(restored.connections.some(w => w.id === 'branch'));
  assert.ok(restored.connections.some(w => w.id === 'trunk'));

  console.log('PASS schematic standalone Pin positioning and junction inspector deletion');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
