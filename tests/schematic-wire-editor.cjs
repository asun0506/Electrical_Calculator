const assert = require('node:assert/strict');
const fs = require('node:fs');
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
  const page = await browser.newPage({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true });
  let acceptDialog = true;
  page.on('dialog', dialog => acceptDialog ? dialog.accept() : dialog.dismiss());
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => ElectricalToolkit.open('schematic'));
  await page.waitForSelector('#schDiagram');

  await page.evaluate(() => ElectricalToolkit.get('schematic').restoreDraft({
    meta: { title: 'wire-editor' },
    components: [
      { id: 'source', name: 'Source', type: 'component', x: 100, y: 100, w: 180, h: 120, connectors: [{ id: 'source-j1', name: 'J1', side: 'right', pins: [{ id: 'source-p1', no: '1', definition: 'SIG' }] }], devices: [] },
      { id: 'target', name: 'Target', type: 'component', x: 700, y: 100, w: 180, h: 120, connectors: [{ id: 'target-j1', name: 'J1', side: 'left', pins: [{ id: 'target-p1', no: '1', definition: 'SIG' }] }], devices: [] },
    ],
    connections: [{ id: 'wire', from: 'pin:source-p1', type: 'lv', gauge: '', net: 'SIG', function: 'Signal', targets: [{ id: 'wire-target', to: 'pin:target-p1', waypoints: [] }] }],
    revisions: [],
  }));

  const gauge = page.locator('.sch-wires tr[data-wire-id="wire"] [data-wire-field="gauge"]');
  assert.equal(await gauge.getAttribute('required'), null, 'wire gauge is optional');
  assert.doesNotMatch(await page.locator('[data-wire-label="wire:wire-target"]').textContent(), /线径未填写/);

  await page.locator('[data-wire-segment="wire:wire-target"]').first().evaluate(element => {
    const svg = element.ownerSVGElement.getBoundingClientRect();
    const clientX = svg.left + svg.width / 2;
    const clientY = svg.top + 180 * svg.height / 900;
    element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX, clientY }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX, clientY }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }));
  });
  const inspector = page.locator('[data-wire-inspector="wire"]');
  await inspector.waitFor();
  assert.deepEqual((await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections[0].targets[0].waypoints)), [], 'opening the inspector must not freeze an automatic route into explicit waypoints');
  await inspector.locator('[data-inspector-wire-field="gauge"]').fill('0.75 mm²');
  await inspector.locator('[data-inspector-wire-field="net"]').fill('NET_A');
  assert.equal(await gauge.inputValue(), '0.75 mm²');
  assert.equal(await page.locator('.sch-wires tr[data-wire-id="wire"] [data-wire-field="net"]').inputValue(), 'NET_A');
  await page.locator('.sch-wires tr[data-wire-id="wire"] [data-wire-field="function"]').fill('Updated in workspace');
  assert.equal(await inspector.locator('[data-inspector-wire-field="function"]').inputValue(), 'Updated in workspace');
  assert.equal((await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections[0])).function, 'Updated in workspace');
  if (process.env.SCHEMATIC_WIRE_SCREENSHOT) await page.screenshot({ path: process.env.SCHEMATIC_WIRE_SCREENSHOT, fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await inspector.count(), 0);

  await gauge.fill('');
  const svgDownload = page.waitForEvent('download');
  await page.locator('#schExportSvg').click();
  const svgPath = path.join(root, 'schematic-optional-gauge-test.svg');
  await (await svgDownload).saveAs(svgPath);
  const svgText = fs.readFileSync(svgPath, 'utf8');
  fs.unlinkSync(svgPath);
  assert.doesNotMatch(svgText, /线径未填写/);

  await page.locator('.sch-legend-hit').click();
  const legendInspector = page.locator('[data-legend-inspector]');
  await legendInspector.waitFor();
  await legendInspector.locator('[data-legend-label="lv"]').fill('低压信号线（自定义）');
  await legendInspector.locator('[data-legend-note]').fill('A&B <test>');
  assert.match(await page.locator('.sch-legend').textContent(), /低压信号线（自定义）/);
  assert.match(await page.locator('.sch-legend').textContent(), /A&B <test>/);
  assert.match(await page.locator('#schDiagram').evaluate(el => el.outerHTML), /A&amp;B &lt;test&gt;/);
  const noteDownload = page.waitForEvent('download');
  await page.locator('#schExportSvg').click();
  const notePath = path.join(root, 'schematic-legend-note-test.svg');
  await (await noteDownload).saveAs(notePath);
  assert.match(fs.readFileSync(notePath, 'utf8'), /A&amp;B &lt;test&gt;/);
  fs.unlinkSync(notePath);
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().meta.legendLabels.lv), '低压信号线（自定义）');
  if (process.env.SCHEMATIC_LEGEND_SCREENSHOT) await page.screenshot({ path: process.env.SCHEMATIC_LEGEND_SCREENSHOT, fullPage: true });

  await page.keyboard.press('Escape');
  await page.locator('[data-legend-type="lv"] text').click();
  await legendInspector.waitFor();

  const jsonDownload = page.waitForEvent('download');
  await page.locator('#schExportJson').click();
  const jsonPath = path.join(root, 'schematic-legend-roundtrip-test.json');
  await (await jsonDownload).saveAs(jsonPath);
  const exported = fs.readFileSync(jsonPath);
  fs.unlinkSync(jsonPath);
  await page.evaluate(() => {
    const draft = ElectricalToolkit.get('schematic').captureDraft();
    delete draft.meta.legendLabels;
    ElectricalToolkit.get('schematic').restoreDraft(draft);
  });
  await page.locator('#schImport').setInputFiles({ name: 'schematic-legend-roundtrip-test.json', mimeType: 'application/json', buffer: exported });
  assert.match(await page.locator('.sch-legend').textContent(), /低压信号线（自定义）/);
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().meta.legendNote), 'A&B <test>');
  assert.equal(await page.locator('.sch-legend [data-twist-symbol]').count(), 1, 'legend uses the paired-line marker');

  const beforeInvalid = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  const uploadInvalid = async mutation => {
    const data = structuredClone(beforeInvalid);
    mutation(data);
    await page.locator('#schImport').setInputFiles({ name: 'invalid-settings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    assert.deepEqual(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft()), beforeInvalid, 'invalid setting must not replace the open drawing');
  };
  await uploadInvalid(data => { data.connections[0].colorOrderSwapped = 'false'; });
  await uploadInvalid(data => { data.meta.titleBlockX = { x: 12 }; });

  await page.evaluate(() => {
    const draft = ElectricalToolkit.get('schematic').captureDraft();
    for (const component of draft.components) {
      const connector = component.connectors[0];
      connector.pins[0].twisted = true;
      connector.pins[0].pairGroup = '1';
      connector.pins.push({ id: component.id + '-p2', no: '2', definition: 'PAIR_B', twisted: true, pairGroup: '1' });
    }
    draft.connections[0].type = 'can';
    draft.connections[0].pairFrom = 'pin:source-p2';
    draft.connections[0].targets[0].pairTo = 'pin:target-p2';
    ElectricalToolkit.get('schematic').restoreDraft(draft);
  });
  assert.ok(await page.locator('.sch-wire-twisted [data-twist-symbol]').count() > 0, 'paired wire uses the same marker construction as the legend');
  await page.evaluate(() => {
    const draft = ElectricalToolkit.get('schematic').captureDraft();
    draft.components[0].connectors[0].side = 'bottom';
    draft.components[1].connectors[0].side = 'top';
    draft.components[1].x = draft.components[0].x;
    draft.components[1].y = 500;
    ElectricalToolkit.get('schematic').restoreDraft(draft);
  });
  assert.ok(await page.locator('.sch-wire-twisted [data-twist-symbol="vertical"]').count() > 0, 'vertical paired run rotates the marker');

  await page.locator('[data-wire-segment="wire:wire-target"]').first().evaluate(element => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 850, clientY: 400 }));
  });
  const canInspector = page.locator('[data-wire-inspector="wire"]');
  await canInspector.waitFor();
  const originalCoreColor = await page.locator('[data-wire-branch="wire:wire-target"] .sch-can-high').getAttribute('stroke');
  await canInspector.locator('[data-swap-wire-colors]').click();
  assert.notEqual(await page.locator('[data-wire-branch="wire:wire-target"] .sch-can-high').getAttribute('stroke'), originalCoreColor);
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections[0].colorOrderSwapped), true);
  const beforeDelete = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  acceptDialog = false;
  await canInspector.locator('[data-delete-wire-inspector]').click();
  assert.deepEqual(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft()), beforeDelete);
  acceptDialog = true;
  await canInspector.locator('[data-delete-wire-inspector]').click();
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections.length), 0);
  await page.locator('#schUndo').click();
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections.length), 1);

  await page.evaluate(() => {
    const draft = ElectricalToolkit.get('schematic').captureDraft();
    const base = draft.connections[0];
    draft.connections.push({ ...structuredClone(base), id: 'other', colorOrderSwapped: false, targets: [{ ...structuredClone(base.targets[0]), id: 'other-target' }] });
    draft.connections.push({ ...structuredClone(base), id: 'child', parentWireId: base.id, parentTargetId: base.targets[0].id, type: 'lv', targets: [{ ...structuredClone(base.targets[0]), id: 'child-target' }] });
    ElectricalToolkit.get('schematic').restoreDraft(draft);
  });
  const otherColor = await page.locator('[data-wire-branch="other:other-target"] .sch-can-high').getAttribute('stroke');
  await page.locator('[data-wire-segment="wire:wire-target"]').first().evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.locator('[data-wire-inspector="wire"] [data-swap-wire-colors]').click();
  assert.equal(await page.locator('[data-wire-branch="other:other-target"] .sch-can-high').getAttribute('stroke'), otherColor, 'other twisted pair keeps its own order');
  await page.keyboard.press('Escape');

  await page.locator('[data-wire-segment="child:child-target"]').first().evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.locator('[data-wire-inspector="child"] [data-delete-wire-inspector]').click();
  assert.deepEqual((await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections.map(w => w.id))).sort(), ['other', 'wire']);
  await page.locator('#schUndo').click();
  await page.locator('[data-wire-segment="wire:wire-target"]').first().evaluate(element => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.locator('[data-wire-inspector="wire"] [data-delete-wire-inspector]').click();
  assert.deepEqual(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().connections.map(w => w.id)), ['other'], 'deleting a parent includes its child but not a sibling');

  console.log('PASS schematic canvas wire editor, optional gauge and editable legend');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
