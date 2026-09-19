const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const cases = {
  conductor: ['#cdImportJson', value => ({ ...value, conductors: [7] })],
  'relay-fuse': ['#cc-file', value => ({ ...value, type: 'relay-fuse', battery: { ...value.battery, voltageV: 777 }, curves: [{ name: 'invalid', points: 'wrong' }] })],
  bolt: ['#btImportJson', value => ({ ...value, parts: [{ joints: [7] }] })],
  dfmea: ['#dfJsonFile', value => ({ ...value, rows: [7] })],
  dvpr: ['#dvJsonImport', value => ({ ...value, rows: [7] })],
  iec60664: ['.iec-json-file', value => ({ ...value, project: { ...value.project, name: 'invalid replacement' }, levels: [7] })],
  schematic: ['#schImport', value => ({ ...value, components: [7] })],
  'sor-generator': ['#sorImportJson', value => ({ ...value, meta: { fileName: 'invalid replacement' }, fields: [], tables: [] })],
};

async function assertRejectedImport(page, id) {
  const [selector, invalid] = cases[id];
  const before = await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id);
  const messages = [];
  // Recording alerts avoids browser modal waits, while retaining import confirmations.
  await page.evaluate(() => { window.__originalImportDialogs = { alert: window.alert, confirm: window.confirm }; window.__importMessages = []; window.alert = text => window.__importMessages.push(String(text)); window.confirm = () => true; });
  await page.locator(selector).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid(before))) });
  await page.waitForFunction(selector => !document.querySelector(selector)?.value, selector);
  // FileReader-based relay imports reset the input before the reader finishes.
  if (id === 'relay-fuse') await page.waitForFunction(() => window.__importMessages.length > 0);
  messages.push(...await page.evaluate(() => window.__importMessages));
  assert.deepEqual(await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id), before, `${id}: invalid import must preserve current state`);
  assert.ok(messages.some(text => /失败|格式|条目/.test(text)), `${id}: rejected import must explain the problem`);
  await page.evaluate(() => { Object.assign(window, window.__originalImportDialogs); delete window.__originalImportDialogs; });
  console.log(`PASS ${id}: invalid import preserves current state`);
}

module.exports = { assertRejectedImport };
if (require.main === module) {
  (async () => {
    const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
    let failed = false;
    try {
      for (const id of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(cases)) {
        const page = await browser.newPage();
        try {
          await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
          await page.evaluate(id => ElectricalToolkit.open(id), id);
          await assertRejectedImport(page, id);
        } catch (error) { failed = true; console.error(error.message); }
        finally { await page.close(); }
      }
    } finally { await browser.close(); }
    process.exitCode = failed ? 1 : 0;
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
