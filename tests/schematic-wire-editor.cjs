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
  page.on('dialog', dialog => dialog.accept());
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
  assert.match(await page.locator('.sch-legend').textContent(), /低压信号线（自定义）/);
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft().meta.legendLabels.lv), '低压信号线（自定义）');
  if (process.env.SCHEMATIC_LEGEND_SCREENSHOT) await page.screenshot({ path: process.env.SCHEMATIC_LEGEND_SCREENSHOT, fullPage: true });

  const saved = await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft());
  await page.evaluate(value => ElectricalToolkit.get('schematic').restoreDraft(value), saved);
  assert.match(await page.locator('.sch-legend').textContent(), /低压信号线（自定义）/);

  console.log('PASS schematic canvas wire editor, optional gauge and editable legend');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
