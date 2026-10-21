const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
    await page.goto(url); await page.waitForSelector('.calc-body');
    const ids = await page.evaluate(() => ElectricalToolkit.list().map(x => x.id));
    for (const id of ids) {
      await page.evaluate(id => ElectricalToolkit.open(id), id);
      if (['materials', 'engineering-formulas', 'standards-library'].includes(id)) {
        assert.equal(await page.locator('[data-project-select]').count(), 0, `${id} remains a shared query page`); continue;
      }
      const baselineContext = await browser.newContext(), baseline = await baselineContext.newPage();
      await baseline.goto(url); await baseline.evaluate(id => ElectricalToolkit.open(id), id);
      const defaults = await baseline.locator('.calc-body input:not([type=file]):not([type=hidden]):not([disabled]):visible,.calc-body textarea:visible').first().inputValue();
      await baselineContext.close();
      const idA = await page.locator('[data-project-select]').inputValue();
      const first = page.locator('.calc-body input:not([type=file]):not([type=hidden]):not([disabled]):visible,.calc-body textarea:visible').first();
      const value = await first.getAttribute('type') === 'number' ? '123.45' : `项目A-${id}`;
      await first.fill(value); await page.evaluate(() => ElectricalToolkit.flush());
      const a = await page.evaluate(() => CalculatorDrafts.capture(ElectricalToolkit.active(), document.querySelector('.calc-body')));
      const result = await page.evaluate(() => ElectricalProjectController.newProject('新建默认项目'));
      assert.equal(result.ok, true, `${id} new project`);
      assert.equal(await page.locator('.calc-body input:not([type=file]):not([type=hidden]):not([disabled]):visible,.calc-body textarea:visible').first().inputValue(), defaults, `${id} defaults match clean browser`);
      await page.evaluate(({ id, project }) => ElectricalProjectController.open(id, project), { id, project: idA });
      assert.deepEqual(await page.evaluate(() => CalculatorDrafts.capture(ElectricalToolkit.active(), document.querySelector('.calc-body'))), a, `${id}: A restored including model`);
      await page.reload(); await page.waitForSelector('.calc-body');
      assert.deepEqual(await page.evaluate(() => CalculatorDrafts.capture(ElectricalToolkit.active(), document.querySelector('.calc-body'))), a, `${id}: A reload`);
      const valid = await page.evaluate(id => { const adapter = ElectricalProjectAdapters.get(id), payload = adapter.capture(document.querySelector('.calc-body')); return adapter.validate({ ...payload, model: { corrupt: true } }).ok; }, id);
      if (['relay-fuse', 'conductor', 'bolt', 'iec60664', 'part-estimator', 'dvpr', 'schematic', 'dfmea', 'sor-generator', 'bend-radius', 'tolerance', 'harness-od'].includes(id)) assert.equal(valid, false, `${id} rejects corrupt dynamic model`);
      console.log('PASS independent projects/defaults/reload:', id);
    }
    await page.evaluate(() => ElectricalToolkit.open('sor-generator'));
    // Delay only FileReader completion, then switch projects while an image is pending.
    await page.evaluate(() => { const read = FileReader.prototype.readAsDataURL; FileReader.prototype.readAsDataURL = function (file) { setTimeout(() => read.call(this, file), 600); }; });
    const oldId = await page.locator('[data-project-select]').inputValue();
    const imageInput = page.locator('[data-cell-image]').first();
    await imageInput.setInputFiles({ name: 'pending.png', mimeType: 'image/png', buffer: png });
    await page.evaluate(() => ElectricalProjectController.newProject('不得混入旧图'));
    await page.waitForTimeout(900);
    assert.deepEqual(await page.evaluate(() => ElectricalToolkit.get('sor-generator').captureDraft().cellImages), {}, 'old async image must not enter new project');
    await page.evaluate(() => ElectricalToolkit.open('bolt'));
    await page.evaluate(() => ElectricalProjectController.renameProject('报告独立项目'));
    const download = page.waitForEvent('download'); await page.locator('#btExportJson').click();
    assert.match((await download).suggestedFilename(), /报告独立项目/, 'report filename identifies current module project');
    await page.evaluate(() => { window.print = () => {}; });
    await page.locator('#btExportPdf').click();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert.match(await page.locator('#btPrint .workspace-report-project').textContent(), /报告独立项目/, 'printed report identifies the function project without replacing its business title');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert.deepEqual(errors, []);
    assert.ok(oldId);
    console.log('PASS stale attachment session isolation and project report identity');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
