/* Run with PLAYWRIGHT_MODULE pointing to playwright if it is not installed locally. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'tmp', 'pdfs');
fs.mkdirSync(artifacts, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'electrical-draft-qa-'));
const launchOptions = { executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
  args: ['--allow-file-access-from-files', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'], viewport: { width: 1500, height: 1000 } };
let context;
let page;
const errors = [];
const url = pathToFileURL(path.join(root, 'index.html')).href;
async function start() {
  context = await chromium.launchPersistentContext(profile, launchOptions);
  page = context.pages()[0] || await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.waitForSelector('.draft-toolbar');
}
async function open(id) {
  await page.evaluate((id) => ElectricalToolkit.open(id), id);
  assert.equal(await page.locator('.module-error').count(), 0, `${id} renders`);
}
async function saved() { await page.waitForFunction(() => document.querySelector('.draft-toolbar [role=status]')?.textContent.startsWith('已保存')); }
async function values() { return page.evaluate(() => CalculatorDrafts.captureForm(document.querySelector('.calc-body'))); }
async function roundTrip(id) {
  const expected = await values();
  await open(id === 'precharge' ? 'bolt' : 'precharge');
  await open(id);
  assert.deepEqual(await values(), expected, `${id}: navigation restores every field`);
  await saved();
  await page.reload();
  await page.waitForSelector('.draft-toolbar');
  assert.deepEqual(await values(), expected, `${id}: reload restores every field`);
}
(async () => {
  await start();
  const ids = await page.evaluate(() => ElectricalToolkit.list().map((calc) => calc.id));
  for (const id of ids) {
    await open(id);
    // Exercise generic/native drafts even when the current input is invalid or blank.
    const first = page.locator('.calc-body input:not([type=file]):not([type=hidden]):not([disabled]):visible, .calc-body textarea:visible').first();
    if (await first.count()) {
      const type = await first.getAttribute('type');
      await first.fill(type === 'number' ? '123.45' : `草稿 QA ${id}`);
    }
    await roundTrip(id);
    console.log('PASS round trip:', id);
  }

  for (const [id, add, row, input] of [
    ['tolerance', '#tc-add', '#tc-rows .chain-row', '.tc-name'],
    ['bend-radius', '#bd-add', '#bd-rows .bd-row', '.bd-d'],
    ['harness-od', '#hw-add', '#hw-rows .bd-row', '.hw-qty'],
    ['conductor', '#cdAdd', '[data-conductor-id]', '[data-field=name]'],
  ]) {
    await open(id); await page.locator(add).click(); await page.locator(add).click();
    await page.locator(row).last().locator(input).fill(id === 'tolerance' || id === 'conductor' ? '新增草稿行' : '7');
    await roundTrip(id);
    await page.locator(row).last().locator('button').first().click();
    await roundTrip(id);
    console.log('PASS dynamic rows:', id);
  }

  await open('snapfit');
  await page.locator('#sf-mat').selectOption('__custom');
  await page.locator('#sf-cus-name').fill('自定义材料草稿');
  await page.locator('#sf-cus-es').fill('4321');
  await page.locator('[data-kind=torsion]').click();
  await roundTrip('snapfit');
  assert.equal(await page.locator('[data-kind=torsion]').getAttribute('class').then(s => s.includes('active')), true);

  await open('materials');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#mt-edit').click();
  await page.locator('.mt-p').first().fill('13579');
  await page.locator('#mt-curve-add').click();
  await roundTrip('materials');
  assert.equal(await page.locator('.mt-p').first().isEnabled(), true, 'unfinished material edits remain editable');

  await open('iec60664');
  await page.locator('[data-action=add-dim]').first().click();
  await page.locator('[data-dim-field=name]').first().fill('绝缘尺寸草稿');
  await roundTrip('iec60664');

  await open('conductor');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.locator('[data-row-image]').first().setInputFiles({ name: 'draft-image.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image?.dataUrl);
  await roundTrip('conductor');
  const image = await page.evaluate(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image.dataUrl);

  await open('sor-generator');
  await page.locator('.sor-add-row').first().click();
  await page.locator('textarea[data-table-id]').first().fill('SOR 表格草稿');
  await page.locator('#sorAttachmentInput').setInputFiles({ name: 'large-draft-test.txt', mimeType: 'text/plain', buffer: Buffer.alloc(6 * 1024 * 1024, 65) });
  await page.waitForFunction(() => ElectricalToolkit.get('sor-generator').captureDraft().attachments.length === 1);
  await roundTrip('sor-generator');
  await saved();
  await context.close();
  await start();
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('sor-generator').captureDraft().attachments[0].size), 6 * 1024 * 1024);
  await open('conductor');
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image.dataUrl), image);
  console.log('PASS process restart with image and >localStorage-quota attachment');

  await open('relay-fuse');
  await page.locator('#rf-pack-voltage').fill('456');
  await page.locator('#rf-analysis').fill('人工确认：保留用户输入的分析，不附加固定判读文字。');
  await page.locator('#cc-add-curve').click();
  await page.locator('.btn-add-pt').last().click();
  await page.locator('.pt-i').last().fill('2345'); // Deliberately unfinished point.
  await roundTrip('relay-fuse');
  const beforeReset = await values();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('.draft-reset').click();
  assert.deepEqual(await values(), beforeReset, 'cancel reset preserves the whole draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.draft-reset').click();
  assert.equal(await page.locator('#rf-pack-voltage').inputValue(), '400');
  await saved(); await page.reload(); await page.waitForSelector('.draft-toolbar');
  assert.equal(await page.locator('#rf-pack-voltage').inputValue(), '400', 'reset persists');
  await open('conductor');
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image.dataUrl), image, 'reset isolates other modules');
  await open('relay-fuse');
  await page.locator('#rf-analysis').fill('人工校核：本报告仅包含自定义分析。');
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('#rf-export-pdf').click();
  await page.waitForSelector('body > .rf-report-shell.active', { state: 'attached' });
  const reportText = await page.locator('.rf-report').innerText();
  assert.ok(!reportText.includes('判读原则：') && !reportText.includes('理想初始外短电流上限'));
  assert.ok(reportText.includes('本报告仅包含自定义分析'));
  assert.equal(await page.locator('.rf-report .legend-swatch line').count(), 5);
  assert.equal(await page.locator('.rf-report .legend-swatch line[stroke-dasharray]').count(), 1);
  await page.pdf({ path: path.join(artifacts, 'relay-draft-qa.pdf'), preferCSSPageSize: true, printBackground: false });
  // Page.printToPDF fires afterprint; inspect rendered PDF pages rather than the restored editor.
  await page.locator('#rf-analysis').fill('');
  await page.locator('#rf-export-pdf').click();
  assert.ok(!(await page.locator('.rf-report').textContent()).includes('未填写人工校核分析'));
  assert.equal(await page.locator('.rf-report-analysis').count(), 0, 'empty analysis produces no boilerplate');

  const blockedPage = await context.newPage();
  await blockedPage.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('QA storage unavailable'); };
    Object.defineProperty(window, 'indexedDB', { value: { open() { throw new Error('QA storage unavailable'); } } });
  });
  await blockedPage.goto(url);
  await blockedPage.waitForFunction(() => document.querySelector('.draft-toolbar [role=status]')?.textContent.includes('保存失败'));
  await blockedPage.close();
  console.log('PASS explicit storage-failure warning');
  assert.deepEqual(errors, [], 'no browser exceptions');
  await context.close();
  console.log('PASS PDF without background printing; artifacts:', artifacts);
})().catch(async (error) => { console.error(error); if (context) await context.close(); process.exitCode = 1; });
