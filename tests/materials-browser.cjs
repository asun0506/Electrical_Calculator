const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } }), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => ElectricalToolkit.open('materials'));
    async function select(name) {
      const category = await page.evaluate(id => window.MATERIAL_DB[id].category, name);
      await page.locator('#mt-cat').selectOption(category); await page.locator('#mt-name').selectOption(name); await page.locator('#mt-query').click();
    }
    await select('PBT+GF30');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').count(), 1, 'missing tensile strength must not be hidden');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '140');
    assert.equal(await page.locator('.mt-p[data-k=elong]').inputValue(), '3');
    await page.evaluate(() => CalculatorDrafts.restore(ElectricalToolkit.get('materials'), document.querySelector('.calc-body'), {
      model: { category: '塑料', name: 'PBT+GF30', editing: true, newOpen: false, rows: [1, 0] }, tabs: [], details: [],
      form: [{ id: 'mt-cat', index: 0, value: '塑料' }, { id: 'mt-name', index: 1, value: 'PBT+GF30' },
        ...['10000', '0.35', '1.53', '3700', '130', '91', '0.36', '1111', '226', '10000000000000', '21', '2', '140'].map((value, index) => ({ id: '', index: index + 2, value }))],
    }));
    assert.equal(await page.locator('.mt-p[data-k=shear]').inputValue(), '91', 'legacy anonymous fields must retain their old property meaning');
    assert.equal(await page.locator('.mt-p[data-k=lambda]').inputValue(), '0.36');
    assert.equal(await page.locator('.mt-p[data-k=Cp]').inputValue(), '1111');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '140', 'new fields must not consume old shear values');
    assert.equal(await page.locator('#mt-table-body input[data-c=s]').inputValue(), '140', 'old curve fields must not shift into scalar properties');
    const hiddenForm = {
      model: { category: '塑料', name: 'PBT+GF30', editing: true, newOpen: false, rows: [1, 1] }, tabs: [], details: [],
      form: [{ id: 'mt-cat', value: '塑料' }, { id: 'mt-name', value: 'PBT+GF30' }, { id: 'mtn-cat', value: '塑料' }, { id: 'mtn-name', value: '旧新增草稿' },
        ...['90000', ...Array(15).fill(''), '4', '5', '10000', '0.35', '1.53', '3700', '130', '91', '0.36', '1111', '226', '10000000000000', '21', '2', '140'].map(value => ({ id: '', value }))].map((item, index) => ({ ...item, index })),
    };
    await page.evaluate(saved => CalculatorDrafts.restore(ElectricalToolkit.get('materials'), document.querySelector('.calc-body'), saved), hiddenForm);
    assert.equal(await page.locator('.mt-p[data-k=E]').inputValue(), '10000', 'cancelled hidden new-form controls must not overwrite the current material');
    assert.equal(await page.locator('.mt-p[data-k=shear]').inputValue(), '91');
    hiddenForm.model.newOpen = true;
    await page.evaluate(saved => CalculatorDrafts.restore(ElectricalToolkit.get('materials'), document.querySelector('.calc-body'), saved), hiddenForm);
    assert.equal(await page.locator('#mtn-p-E').inputValue(), '90000', 'active old new-form draft values remain assigned to new-form fields');
    assert.equal(await page.locator('#mtn-table-body input[data-c=s]').inputValue(), '5');
    assert.equal(await page.locator('.mt-p[data-k=shear]').inputValue(), '91');
    await page.locator('#mtn-cancel').click();
    await select('PBT+GF20');
    assert.equal(await page.locator('.mt-p[data-k=E]').inputValue(), '7000');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '118');
    assert.equal(await page.locator('.mt-p[data-k=elong]').inputValue(), '3.5');
    assert.match(await page.locator('[data-reference=Rm]').textContent(), /115.*118|118.*115/);
    assert.match(await page.locator('[data-reference=Rm]').textContent(), /ISO 527/);
    assert.equal(await page.locator('.mt-p[data-k=Rp02]').inputValue(), '', 'break stress must not be invented as a yield stress');
    await select('PBT+ABS+GF20');
    assert.equal(await page.locator('.mt-p[data-k=E]').inputValue(), '6200', 'use tensile, not flexural modulus');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '75');
    assert.equal(await page.locator('.mt-p[data-k=elong]').inputValue(), '2');
    assert.match(await page.locator('[data-reference=E]').textContent(), /MOCOM.*6200/);
    assert.match(await page.locator('[data-reference=Rm]').textContent(), /LG Chem/);
    assert.match(await page.locator('[data-reference=Rm]').textContent(), /ASTM D638/);
    assert.match(await page.locator('[data-reference=elong]').textContent(), /2\.5/);
    assert.equal(await page.locator('.mt-p[data-k=nu]').inputValue(), '', 'unverified properties must remain empty');
    assert.equal(await page.evaluate(() => MaterialReferences.lookup('PBT+ABS+GF20', 'Rm').groups.length), 2, 'ASTM and ISO results must not become one range');
    assert.equal(await page.evaluate(() => MaterialReferences.lookup('PA6+GF30', 'E').groups.length), 2, 'dry and conditioned values must not become one range');
    assert.equal(await page.evaluate(() => MaterialReferences.lookup('PBT', 'elong').groups[0].bound), '>', 'a lower bound is not an exact value');
    const ids = await page.evaluate(() => Object.keys(MATERIAL_DB));
    for (const id of ids) {
      await select(id);
      const properties = await page.locator('#mt-detail .mt-p').count();
      assert.equal(await page.locator('#mt-detail [data-reference]').count(), properties, id + ': every property needs reference guidance');
      const hints = await page.locator('#mt-detail [data-reference]').allTextContents();
      assert.ok(hints.every(text => text.includes('参考') && text.includes('典型厂商')), id + ': show explicit unknowns, not invented ranges');
    }
    await select('FPC');
    assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '');
    assert.match(await page.locator('[data-reference=Rm]').textContent(), /层叠|方向/);
    await page.locator('#mt-edit').click(); await page.locator('.mt-p[data-k=Rm]').fill('61'); await page.locator('#mt-save').click();
    await page.evaluate(() => ElectricalProjectController.flush()); await page.reload();
    await page.waitForSelector('#mt-name'); assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '61', 'newly supplied missing properties persist');
    await page.locator('#mt-reset').click(); assert.equal(await page.locator('.mt-p[data-k=Rm]').inputValue(), '');
    await select('PTFE');
    assert.match(await page.locator('[data-reference=dens]').textContent(), /无量纲/, 'relative specific gravity must not be reported as measured density');
    await select('PBT+ABS+GF20');
    if (process.env.MATERIAL_QA_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.MATERIAL_QA_SCREENSHOTS, 'materials-reference-desktop.png'), fullPage: true });
    const download = page.waitForEvent('download'); await page.locator('#mt-export').click();
    const stream = await (await download).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
    const report = Buffer.concat(chunks).toString('utf8');
    assert.match(report, /MOCOM/); assert.match(report, /ISO 527/); assert.match(report, /参考/); assert.match(report, /75/);
    const collision = await browser.newPage();
    await collision.addInitScript(() => localStorage.setItem('matdb_custom', JSON.stringify(Object.fromEntries(['PBT+GF20', 'PBT+ABS+GF20'].map(name => [name, { name, category: '塑料', cn: '用户原有材料', E: 12345, Rm: 777, elong: 12, curve: [[0, 0], [2, 42]] }])))));
    await collision.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await collision.evaluate(() => ElectricalToolkit.open('materials'));
    for (const name of ['PBT+GF20', 'PBT+ABS+GF20']) {
      await collision.locator('#mt-cat').selectOption('塑料'); await collision.locator('#mt-name').selectOption(name); await collision.locator('#mt-query').click();
      assert.equal(await collision.locator('.mt-p[data-k=E]').inputValue(), '12345', name + ': built-in addition must not replace prior custom values');
      assert.equal(await collision.locator('.mt-p[data-k=Rm]').inputValue(), '777');
      assert.equal(await collision.locator('#mt-table-body tr:has(input)').count(), 2, 'prior custom curve must remain');
    }
    await collision.close();
    assert.deepEqual(errors, []);
    console.log('PASS materials: missing fields, sourced GF20 defaults, typed reference ranges, all-property guidance, persisted edits and sourced exports');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
