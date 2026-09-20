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
    args: ['--allow-file-access-from-files']
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => ElectricalToolkit.open('schematic'));
  await page.waitForSelector('#schDiagram');
  assert.deepEqual(await page.evaluate(() => Object.keys(ElectricalSchematic)), ['model', 'geometry', 'routing'], 'classic script namespaces load in dependency order through file:// while offline');

  const overflowingEditors = await page.locator('#schEntities .sch-component-editor').evaluateAll(cards =>
    cards.filter(card => card.scrollWidth > card.clientWidth + 1).map(card => ({
      id: card.dataset.componentEditor,
      clientWidth: card.clientWidth,
      scrollWidth: card.scrollWidth
    }))
  );
  assert.deepEqual(overflowingEditors, [], 'component/device editors must not overflow at 1366px');

  const headerWidths = await page.locator('.sch-wires thead th').evaluateAll(headers =>
    headers.map(header => Math.round(header.getBoundingClientRect().width))
  );
  assert.ok(headerWidths[1] >= 380, `source column should receive reclaimed property space, got ${headerWidths[1]}px`);
  assert.ok(headerWidths[2] >= 550, `target column should receive reclaimed property space, got ${headerWidths[2]}px`);
  assert.ok(headerWidths.slice(3, 7).reduce((sum, width) => sum + width, 0) <= 420, `property columns should be about 40% narrower, got ${headerWidths.slice(3, 7).join(' + ')}px`);

  await page.evaluate(() => ElectricalToolkit.get('schematic').restoreDraft({
    meta: { title: 'layout-overflow' },
    components: [
      { id: 'source', name: 'Source', type: 'component', x: 100, y: 100, w: 180, h: 120, connectors: [{ id: 'source-j1', name: 'J1', side: 'right', pins: [{ id: 'source-p1', no: '1', definition: 'SIG' }] }], devices: [] },
      { id: 'target', name: 'Target', type: 'component', x: 700, y: 100, w: 180, h: 120, connectors: [{ id: 'target-j1', name: 'J1', side: 'left', pins: [{ id: 'target-p1', no: '1', definition: 'SIG' }] }], devices: [] }
    ],
    connections: [{ id: 'wire', from: 'pin:source-p1', type: 'lv', gauge: '0.35 mm²', net: 'SIG', function: 'Signal', targets: [{ id: 'wire-target', to: 'pin:target-p1', waypoints: [] }] }],
    revisions: []
  }));
  await page.locator('[data-wire-id="wire"] [data-add-junction-target="wire-target"]').click();
  const branchLayout = await page.locator('.sch-wire-branch-row').evaluate(row => {
    const properties = [...row.children].slice(3, 7);
    return {
      rowClientWidth: row.clientWidth,
      rowScrollWidth: row.scrollWidth,
      propertiesTop: properties.map(cell => Math.round(cell.getBoundingClientRect().top)),
      sourceTop: Math.round(row.children[1].getBoundingClientRect().top),
    };
  });
  assert.ok(branchLayout.rowScrollWidth <= branchLayout.rowClientWidth + 1, `branch row overflowed by ${branchLayout.rowScrollWidth - branchLayout.rowClientWidth}px`);
  assert.ok(branchLayout.propertiesTop.every(top => Math.abs(top - branchLayout.sourceTop) <= 1), 'branch properties must sit to the right on the same row as branch endpoints');
  if (process.env.SCHEMATIC_WIRE_TABLE_SCREENSHOT) await page.locator('.sch-wire-scroll').screenshot({ path: process.env.SCHEMATIC_WIRE_TABLE_SCREENSHOT });

  console.log('schematic responsive layout tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
