const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const selectors = { conductor: '#cdImportJson', 'relay-fuse': '#cc-file', bolt: '#btImportJson', dfmea: '#dfJsonFile', dvpr: '#dvJsonImport', iec60664: '.iec-json-file', schematic: '#schImport', 'sor-generator': '#sorImportJson' };
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const hostile = '<img src=x onerror="window.__injected=true">&"';
const image = { name: hostile, type: 'image/png', size: 68, dataUrl: png };
const copy = value => JSON.parse(JSON.stringify(value));
const comparable = (id, value) => id === 'conductor' ? { ...value, conductors: value.conductors.map(({ id, ...row }) => row) } : value;

async function importFile(page, selector, text) {
  // Invoke the real input and wait for both async file.text and FileReader imports.
  await page.evaluate(() => { window.__messages = []; window.__fileReadDone = false; });
  await page.locator(selector).setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.waitForFunction(selector => !document.querySelector(selector)?.value && (selector !== '#cc-file' || window.__fileReadDone || window.__messages.length), selector);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    for (const [id, selector] of Object.entries(selectors)) {
      if (process.argv.length > 2 && !process.argv.slice(2).includes(id)) continue;
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
        await page.evaluate(id => {
          ElectricalToolkit.open(id);
          window.alert = text => window.__messages.push(String(text)); window.confirm = () => true;
          const read = FileReader.prototype.readAsText;
          FileReader.prototype.readAsText = function (...args) { this.addEventListener('loadend', () => { window.__fileReadDone = true; }); return read.apply(this, args); };
        }, id);
        if (id === 'iec60664') await page.locator('[data-action=add-dim]').first().click();
        if (id === 'dvpr') await page.locator('#dvAddRow').click();
        let valid = await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id);
        if (id === 'conductor') { valid.conductors[0].name = hostile; valid.conductors[0].image = image; }
        if (id === 'relay-fuse') valid.title = hostile;
        if (id === 'bolt') { valid.meta.projectName = hostile; valid.parts[0].image = image; }
        if (id === 'dfmea') valid.rows = [{ id: 'safe-row', D: hostile, tags: [], J: 5, N: 3, P: 5 }];
        if (id === 'dvpr') { valid.rows[0].productName = hostile; valid.rows[0].attachments = [{ name: hostile, size: 1, dataUrl: 'data:text/plain;base64,YQ==' }]; }
        if (id === 'iec60664') { valid.project.name = hostile; valid.levels[0].name = hostile; valid.levels[0].code = hostile; valid.levels[0].dimensions[0].image = png; }
        if (id === 'schematic') valid.meta.title = hostile;
        if (id === 'sor-generator') {
          valid.meta.fileName = hostile;
          const key = await page.locator('[data-cell-image]').first().getAttribute('data-cell-image');
          valid.cellImages[key] = { ...image, width: 1, height: 1 };
          valid.attachments = [{ name: 'evidence.txt', type: 'text/plain', size: 1, category: '其他', note: hostile, dataUrl: 'data:text/plain;base64,YQ==' }];
        }
        await importFile(page, selector, JSON.stringify(valid));
        assert.ok(!(await page.evaluate(() => window.__messages)).some(text => /失败/.test(text)), `${id}: valid historical format accepted`);
        assert.equal(await page.evaluate(() => window.__injected), undefined, `${id}: imported text is inert`);
        assert.equal(await page.locator('[onerror]').count(), 0, `${id}: imported text must not create attributes`);
        const before = await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id);
        assert.ok(JSON.stringify(before).includes(hostile.replace(/"/g, '\\"')), `${id}: imported text retained`);
        await importFile(page, selector, JSON.stringify(before));
        const after = await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id);
        assert.deepEqual(comparable(id, after), comparable(id, before), `${id}: valid project round trip`);

        const rejected = [];
        const bad = copy(after);
        if (id === 'conductor') bad.conductors[0].image.dataUrl = 'data:image/svg+xml;base64,PHN2Zz4=';
        if (id === 'bolt') bad.parts[0].image.dataUrl = 'javascript:alert(1)';
        if (id === 'iec60664') bad.levels[0].dimensions[0].image = 'data:text/html;base64,PGgxPg==';
        if (id === 'sor-generator') Object.values(bad.cellImages)[0].dataUrl = 'data:image/png;base64,!!!!';
        if (id === 'dvpr') bad.rows[0].attachments[0].dataUrl = 'javascript:window.__injected=true';
        if (id === 'schematic') bad.components[0].x = '0" onmouseover="window.__injected=true';
        if (id === 'relay-fuse') bad.curves[0].color = 'red" onmouseover="window.__injected=true';
        if (id === 'dfmea') bad.rows[0].tags = {};
        rejected.push(JSON.stringify(bad), JSON.stringify({ ...after, oversized: 'x'.repeat(10 * 1024 * 1024) }));
        if (id === 'sor-generator') {
          const uppercaseSvg = copy(after);
          uppercaseSvg.attachments[0].dataUrl = 'data:IMAGE/svg+xml;base64,PHN2Zz4=';
          rejected.push(JSON.stringify(uppercaseSvg));
        }
        for (const text of rejected) {
          await importFile(page, selector, text);
          assert.deepEqual(await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id), after, `${id}: unsafe/oversized import preserves full project`);
          assert.ok((await page.evaluate(() => window.__messages)).some(text => /失败|大小/.test(text)), `${id}: rejection explained`);
        }
        const imageInput = { conductor: '[data-row-image]', bolt: '[data-image-owner]', iec60664: '.iec-image-file', 'sor-generator': '[data-cell-image]', dvpr: '[data-attach]' }[id];
        if (id === 'schematic') {
          await page.locator('#schCanvas').evaluate(el => {
            const data = new DataTransfer(); data.setData('application/x-electrical-symbol', '{"kind":"unknown"}');
            el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data, clientX: 250, clientY: 250 }));
          });
          assert.deepEqual(await page.evaluate(() => ElectricalToolkit.get('schematic').captureDraft()), after, 'schematic: invalid palette drop preserves project');
        }
        if (imageInput) {
          for (const file of [
            { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>') },
            { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024 + 1) },
          ]) {
            await page.evaluate(() => { window.__messages = []; });
            await page.locator(imageInput).first().setInputFiles(file);
            await page.waitForFunction(({ id, before }) => window.__messages.length || JSON.stringify(ElectricalToolkit.get(id).captureDraft()) !== before, { id, before: JSON.stringify(after) });
            assert.deepEqual(await page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id), after, `${id}: rejected image upload preserves current image`);
          }
        }
        assert.deepEqual(errors, [], `${id}: no runtime errors`);
        console.log(`PASS ${id}: historical round trip, inert text, unsafe content and 10 MiB limit`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
