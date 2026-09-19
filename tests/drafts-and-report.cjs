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
async function storageCharacterization() {
  await saved();
  await page.evaluate(async () => {
    localStorage.setItem('electrical_toolkit_active_calculator_v1', 'bolt');
    localStorage.setItem('electrical_toolkit_draft_v1:bolt', JSON.stringify({
      id: 'bolt', version: 1, updatedAt: 4000000000000,
      payload: { form: [{ id: '', index: 0, value: '本地草稿兼容项目' }], model: null, tabs: [], details: [] },
    }));
    localStorage.setItem('matdb_override', JSON.stringify({ 'Al-1060-O': { E: 13579 } }));
    localStorage.setItem('matdb_custom', JSON.stringify({ 'Storage custom': {
      name: 'Storage custom', category: '金属', E: 24680, curve: [[0, 0], [1, 100]],
    } }));
    localStorage.setItem('electrical_toolkit_part_estimator_v1', JSON.stringify({
      schemaVersion: 1, projectName: '兼容估价项目', parts: [{ id: 'stored-part',
        basics: { partName: '兼容零件', transportFee: 321 }, materials: [], processes: [], packaging: [],
      }],
    }));
    localStorage.setItem('electrical_toolkit_iec60664_verification_v1', JSON.stringify({
      schemaVersion: 1, project: { name: '兼容绝缘项目', number: 'IEC-STORED' },
      levels: [{ id: 'cell', voltage: 7.2, dimensions: [] }],
    }));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('electrical-toolkit-drafts', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put({ id: 'precharge', version: 1, updatedAt: 4000000000000,
          payload: { form: [{ id: 'pc-v', index: 0, value: '654' }], model: null, tabs: [], details: [] } });
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload(); await page.waitForSelector('.draft-toolbar');
  assert.equal(await page.evaluate(() => ElectricalToolkit.active().id), 'bolt', 'raw active key restores selected calculator');
  assert.deepEqual(await page.evaluate(() => CalculatorDrafts.read('bolt').tabs), [], 'existing local draft representation restores');
  assert.equal(await page.locator('[data-meta=projectName]').inputValue(), '本地草稿兼容项目', 'seeded local draft restores form');
  assert.equal(await page.evaluate(() => CalculatorDrafts.read('precharge').form[0].value), '654', 'existing IndexedDB database/store restores');
  await open('precharge');
  assert.equal(await page.locator('#pc-v').inputValue(), '654', 'seeded IndexedDB draft restores form');
  await open('materials');
  await page.locator('#mt-name').selectOption('Al-1060-O');
  await page.locator('#mt-query').click();
  assert.equal(await page.locator('.mt-p[data-k=E]').inputValue(), '13579', 'material override key restores');
  await page.locator('#mt-name').selectOption('Storage custom');
  await page.locator('#mt-query').click();
  assert.equal(await page.locator('.mt-p[data-k=E]').inputValue(), '24680', 'custom material key restores');
  await open('part-estimator');
  assert.equal(await page.locator('#pe-project-name').inputValue(), '兼容估价项目');
  assert.equal(await page.locator('[data-basic=partName]').inputValue(), '兼容零件');
  assert.equal(await page.locator('[data-basic=transportFee]').inputValue(), '321');
  await open('iec60664');
  assert.equal(await page.locator('[data-project=name]').inputValue(), '兼容绝缘项目');
  assert.equal(await page.locator('[data-project=number]').inputValue(), 'IEC-STORED');
  assert.equal(await page.evaluate(() => ElectricalToolkit.get('iec60664').captureDraft().levels[0].voltage), 7.2);
  console.log('PASS seeded compatibility: active ID, local/IndexedDB drafts, material override/custom, estimator, IEC');
}
async function storageFailureBehavior(onlyIEC = false) {
  const failurePage = await context.newPage();
  const alerts = [];
  failurePage.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept(); });
  failurePage.on('pageerror', error => errors.push(error.message));
  await failurePage.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('QA full', 'QuotaExceededError'); };
    IDBObjectStore.prototype.put = () => { throw new DOMException('QA full', 'QuotaExceededError'); };
  });
  await failurePage.goto(url);
  await failurePage.waitForSelector('.draft-toolbar');
  if (!onlyIEC) {
    await failurePage.evaluate(() => ElectricalToolkit.open('relay-fuse'));
    await failurePage.locator('#rf-pack-voltage').fill('567');
    await failurePage.waitForFunction(() => document.querySelector('.draft-toolbar [role=status]')?.textContent.includes('浏览器保存失败'));
    assert.equal(await failurePage.locator('#rf-pack-voltage').inputValue(), '567', 'both failed writes keep current values');
    await failurePage.evaluate(() => { ElectricalToolkit.open('bolt'); ElectricalToolkit.open('relay-fuse'); });
    assert.equal(await failurePage.locator('#rf-pack-voltage').inputValue(), '567', 'failed writes keep session draft');
    await failurePage.evaluate(() => ElectricalToolkit.open('materials'));
    await failurePage.locator('#mt-edit').click();
    await failurePage.locator('.mt-p[data-k=E]').fill('98765');
    alerts.length = 0;
    await failurePage.locator('#mt-save').click();
    assert.ok(alerts.some(text => /导出.*备份/.test(text)), 'material failure offers export backup');
    assert.equal(await failurePage.locator('.mt-p[data-k=E]').inputValue(), '98765');
    await failurePage.evaluate(() => ElectricalToolkit.open('part-estimator'));
    await failurePage.locator('#pe-project-name').fill('保存失败仍保留');
    assert.match(await failurePage.locator('.pe-notice').textContent(), /保存失败.*导出.*备份/, 'estimator input failure immediately offers backup');
    assert.equal(await failurePage.locator('#pe-project-name').inputValue(), '保存失败仍保留');
    await failurePage.locator('[data-action=add-part]').click();
    assert.match(await failurePage.locator('.pe-notice').textContent(), /保存失败.*导出.*备份/);
    assert.doesNotMatch(await failurePage.locator('.pe-notice').textContent(), /数据自动保存在当前浏览器/, 'failed save must not also claim persistence');
  }
  await failurePage.evaluate(() => { ElectricalToolkit.open('iec60664'); delete window.CalculatorDrafts; });
  alerts.length = 0;
  await failurePage.locator('[data-project=name]').fill('IEC 保存失败仍保留');
  await failurePage.waitForTimeout(250);
  assert.ok(alerts.some(text => /导出.*备份/.test(text)), 'IEC standalone save failure offers export backup');
  assert.equal(await failurePage.locator('[data-project=name]').inputValue(), 'IEC 保存失败仍保留');
  await failurePage.close();
  console.log('PASS failed localStorage/IndexedDB writes preserve forms and actionable backup messages');
}
async function objectStoreContract() {
  const result = await page.evaluate(async () => {
    const store = ElectricalStorage.openObjectStore({ database: 'electrical-storage-qa', version: 1, store: 'records', keyPath: 'id' });
    const ready = await store.ready;
    const put = await store.put({ id: 'sample', payload: { value: 42 } });
    const rows = await store.getAll();
    const invalid = await store.put({ missingKey: true });
    const remove = await store.remove('sample');
    const empty = await store.getAll();
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value) {
      const request = original.call(this, value);
      this.transaction.abort();
      return request;
    };
    const aborted = await store.put({ id: 'aborted' });
    IDBObjectStore.prototype.put = original;
    const afterAbort = await store.getAll();
    return { ready, put, rows, invalid, remove, empty, aborted, afterAbort };
  });
  assert.equal(result.ready.ok, true);
  assert.equal(result.put.ok, true);
  assert.deepEqual(result.rows.value, [{ id: 'sample', payload: { value: 42 } }]);
  assert.equal(result.invalid.ok, false, 'missing key does not escape result contract');
  assert.equal(result.remove.ok, true);
  assert.deepEqual(result.empty.value, []);
  assert.equal(result.aborted.ok, false, 'transaction abort cannot report successful persistence');
  assert.deepEqual(result.afterAbort.value, []);
  console.log('PASS IndexedDB facade round trip, remove, invalid value, aborted transaction');
}
(async () => {
  await start();
  await storageCharacterization();
  if (process.argv.includes('--storage-characterization')) { await context.close(); return; }
  if (process.argv.includes('--storage-object-store')) { await objectStoreContract(); await context.close(); return; }
  if (process.argv.includes('--storage-failures') || process.argv.includes('--storage-failure-iec')) {
    await storageFailureBehavior(process.argv.includes('--storage-failure-iec'));
    await context.close(); return;
  }
  await storageFailureBehavior();
  await objectStoreContract();
  for (const id of ['conductor', 'relay-fuse', 'iec60664', 'sor-generator']) {
    await open(id);
    await require('./import-safety-helpers.cjs').assertRejectedImport(page, id);
  }
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

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await open('iec60664');
  await page.locator('[data-action=add-dim]').first().click();
  await page.locator('[data-dim-field=name]').first().fill('绝缘尺寸草稿');
  await page.locator('[data-dim-field=note]').first().fill('人工复核：测量点避开圆角。');
  await page.locator('[data-dim-field=conclusionOverride]').first().selectOption('fail');
  assert.equal((await page.evaluate(()=>ElectricalToolkit.get('iec60664').captureDraft().levels.flatMap(level=>level.dimensions).find(dim=>dim.name==='绝缘尺寸草稿'))).note,'人工复核：测量点避开圆角。');
  await page.locator('.iec-image-file').first().setInputFiles({ name: 'iec-dimension.png', mimeType: 'image/png', buffer: png });await page.locator('[data-action=preview-image]').first().waitFor();
  await page.locator('[data-action=preview-image]').first().click();assert.equal(await page.locator('#engineering-image-preview').evaluate(el=>el.style.display),'flex');await page.locator('#engineering-image-preview button').click();
  await roundTrip('iec60664');
  const reviewedDimension=await page.evaluate(()=>ElectricalToolkit.get('iec60664').captureDraft().levels.flatMap(level=>level.dimensions).find(dim=>dim.name==='绝缘尺寸草稿'));assert.equal(reviewedDimension.note,'人工复核：测量点避开圆角。');assert.equal(reviewedDimension.conclusionOverride,'fail');await page.evaluate(()=>{window.print=()=>{};});await page.locator('[data-action=export-pdf]').click();assert.match(await page.locator('.iec-print-root').innerText(),/人工复核：测量点避开圆角。/);assert.match(await page.locator('.iec-print-root').innerText(),/人工编辑结论/);await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));

  await open('conductor');
  await page.locator('[data-row-image]').first().setInputFiles({ name: 'draft-image.png', mimeType: 'image/png', buffer: png });
  await page.waitForFunction(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image?.dataUrl);
  await page.locator('[data-preview-image]').first().click();assert.equal(await page.locator('#engineering-image-preview').evaluate(el=>el.style.display),'flex');assert.ok(await page.locator('.cd-change-image').first().count());await page.locator('#engineering-image-preview button').click();
  await roundTrip('conductor');
  const image = await page.evaluate(() => ElectricalToolkit.get('conductor').captureDraft().conductors[0].image.dataUrl);

  await open('sor-generator');
  await page.locator('.sor-add-row').first().click();
  await page.locator('textarea[data-table-id]').first().fill('SOR 表格草稿');
  const sorImageInput=page.locator('[data-cell-image]').first();assert.ok(await sorImageInput.count());await sorImageInput.setInputFiles({ name: 'sor-cell.png', mimeType: 'image/png', buffer: png });const sorPreview=page.locator('[data-preview-cell-image]').first();await sorPreview.evaluate(el=>el.click());assert.equal(await page.locator('#engineering-image-preview').evaluate(el=>el.style.display),'flex');assert.match(await sorPreview.locator('xpath=following-sibling::label[1]').textContent(),/更换附图/);await page.locator('#engineering-image-preview button').click();
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
