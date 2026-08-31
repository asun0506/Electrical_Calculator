/* Run with PLAYWRIGHT_MODULE pointing to the bundled playwright module. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tmp', 'pdfs');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
let browser;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
    args: ['--allow-file-access-from-files', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForSelector('.draft-toolbar');
  await page.evaluate(() => {
    window.print = () => {};
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.lastReportBlob = blob; return create(blob); };
    document.addEventListener('click', e => { const a = e.target.closest('a[download]'); if (a) { window.lastReportFilename = a.download; e.preventDefault(); } });
    const en = ElectricalToolkit.reportLanguage('en');
    if (en`<td>结论</td><td>${'不通过 <script>用户输入</script>'}</td>` !== '<td>Result</td><td>不通过 <script>用户输入</script></td>') throw Error('Translation changed user text');
  });
  const open = id => page.evaluate(id => ElectricalToolkit.open(id), id);
  const finishPrint = () => page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const snapshot = id => page.evaluate(id => ElectricalToolkit.get(id).captureDraft(), id);
  async function report(button, selector, expected) {
    await page.locator(button).click();
    await page.waitForSelector(selector, { state: 'attached' });
    const text = await page.locator(selector).textContent();
    assert.ok(text.includes(expected), expected);
    return text;
  }
  await open('conductor');
  await page.evaluate(png => {
    const calc = ElectricalToolkit.get('conductor'), data = calc.captureDraft();
    data.conductors[0].name = '通过 铜 Cu（退火） <Busbar>';
    data.conductors[0].image = { name: 'test.png', dataUrl: png };
    data.limitValue = 1; data.limitUnit = 'ohm'; calc.restoreDraft(data);
  }, png);
  const cdBefore = await snapshot('conductor');
  let text = await report('#cdExportPdfEn', '.cd-report', 'Conductor Resistance Verification Report');
  assert.ok(text.includes('通过 铜 Cu（退火） <Busbar>'), 'Chinese custom name unchanged');
  assert.ok(text.includes('Copper Cu (annealed)') && text.includes('PASS'), text);
  assert.equal(await page.locator('.cd-report-image').getAttribute('src'), png);
  await page.pdf({ path: path.join(output, 'conductor-en.pdf'), preferCSSPageSize: true, printBackground: false });
  await finishPrint();
  assert.deepEqual(await snapshot('conductor'), cdBefore);
  await report('#cdExportPdf', '.cd-report', '导体电阻校核报告'); await finishPrint();
  console.log('PASS conductor: EN/ZH, image, result, unchanged inputs');

  await open('relay-fuse');
  await page.evaluate(() => {
    const calc = ElectricalToolkit.get('relay-fuse'), data = calc.captureDraft();
    data.battery.components.forEach((item, i) => item.name = `Component ${i + 1}`);
    data.curves.forEach((curve, i) => { curve.name = ['Relay withstand', 'Fuse clearing', 'Wire limit', 'Cell limit'][i] || `Curve ${i}`; curve.points = [[100 * (i + 1), 100], [1000 * (i + 1), 1], [5000 * (i + 1), 0.01]]; });
    data.analysis = '人工校核 <analysis>: retained verbatim'; calc.restoreDraft(data);
  });
  const rfBefore = await snapshot('relay-fuse'); delete rfBefore.savedAt;
  text = await report('#rf-export-pdf-en', '.rf-report', 'Battery Short-Circuit and Relay/Fuse Coordination Report');
  assert.ok(text.includes('人工校核 <analysis>: retained verbatim'));
  assert.ok(text.includes('Current I') && text.includes('Time t') && text.includes('Maximum External Short-Circuit Current'), text);
  assert.ok(!/[\u3400-\u9fff]/.test(text.replace('人工校核', '')), 'no untranslated system labels in relay report');
  assert.equal(await page.locator('.rf-report .legend-swatch line').count(), 5);
  assert.equal(await page.locator('.rf-report .legend-swatch line[stroke-dasharray]').count(), 1);
  await page.pdf({ path: path.join(output, 'relay-en.pdf'), preferCSSPageSize: true, printBackground: false });
  await finishPrint();
  assert.deepEqual(await snapshot('relay-fuse'), rfBefore);
  await report('#rf-export-pdf', '.rf-report', '电池包外短与继电器/保险丝保护配合校核报告'); await finishPrint();
  console.log('PASS relay: EN/ZH, chart/legend colors, unchanged analysis and data');

  await open('iec60664');
  await page.evaluate(png => {
    const calc = ElectricalToolkit.get('iec60664'), data = calc.captureDraft();
    data.project.name = 'Test Project'; data.project.author = 'Test Engineer';
    data.levels.forEach((level, i) => {
      level.dimensions = [{ id: `dim-${i}`, name: 'Gap <A>', kind: i === 1 ? 'creepage' : 'clearance', image: png, nominal: 20,
        toleranceMode: 'chain', verificationMethod: ['rss3', 'rss4', 'worst'][i], contributors: [
          { id: 'p1', name: 'Main dimension', size: 20, tolerance: 0.15, type: 'size', direction: '+', factor: 1 },
          { id: 'p2', name: 'Profile', size: 0, tolerance: 0.2, type: 'profile', direction: '-', factor: 0.5 },
        ] }];
    }); calc.restoreDraft(data);
  }, png);
  const iecBefore = await snapshot('iec60664');
  text = await report('[data-action=export-pdf-en]', '.iec-report', 'Clearance / Creepage Design Verification Report');
  assert.ok(!/[\u3400-\u9fff]/.test(text), 'no untranslated system labels in IEC report');
  assert.ok(text.includes('Density') && text.includes('μ Nominal') && text.includes('Worst-case'));
  await page.pdf({ path: path.join(output, 'iec-en.pdf'), preferCSSPageSize: true, printBackground: false });
  await finishPrint();
  assert.deepEqual(await snapshot('iec60664'), iecBefore);
  await report('[data-action=export-pdf]', '.iec-report', '电气间隙 / 爬电距离系统设计校核报告'); await finishPrint();
  await page.locator('[data-action=export-word-en]').click();
  const word = await page.evaluate(async () => ({ text: await lastReportBlob.text(), name: lastReportFilename }));
  assert.ok(word.text.includes('lang="en"') && word.text.includes('Clearance / Creepage Design Verification Report') && word.text.includes('841.9pt 595.3pt'));
  assert.ok(word.text.includes(png) && word.name.endsWith('_EN.doc'));
  await page.locator('[data-action=export-word]').click();
  assert.ok((await page.evaluate(() => lastReportBlob.text())).includes('电气间隙 / 爬电距离系统设计校核报告'));
  console.log('PASS IEC: EN/ZH PDF+Word, A4, image, sigma methods, unchanged data');

  await open('part-estimator');
  await page.evaluate(() => { XLSX.writeFile = (wb, name) => window.lastWorkbook = { name, sheets: wb.SheetNames.map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1}) })) }; });
  for (const kind of ['project', 'part']) {
    await page.locator(`[data-action=export-${kind}-excel]`).click();
    const zh = await page.evaluate(() => lastWorkbook);
    await page.locator(`[data-action=export-${kind}-excel-en]`).click();
    const en = await page.evaluate(() => lastWorkbook);
    assert.ok(en.name.endsWith('_EN.xlsx')); assert.equal(en.sheets[0].name, 'Project Summary');
    assert.equal(en.sheets[0].rows[0][0], 'Part No.');
    assert.deepEqual(en.sheets[0].rows.slice(1), zh.sheets[0].rows.slice(1));
    assert.deepEqual(en.sheets.flatMap(s => s.rows.flat().filter(v => typeof v === 'number')), zh.sheets.flatMap(s => s.rows.flat().filter(v => typeof v === 'number')));
  }
  console.log('PASS estimator: current/project EN Excel, numbers unchanged');
  await open('materials');
  for (const suffix of ['', '-all']) {
    await page.locator(`#mt-export${suffix}`).click();
    const zh = await page.evaluate(() => lastReportBlob.text());
    await page.locator(`#mt-export${suffix}-en`).click();
    const en = await page.evaluate(() => lastReportBlob.text());
    assert.ok(en.includes('lang="en"') && en.includes('Engineering Strain') && en.includes('Material Name'));
    assert.ok(!en.includes('<th>特性参数</th>'));
    assert.deepEqual(en.match(/<td>[\d.eE+−-]+<\/td>/g), zh.match(/<td>[\d.eE+−-]+<\/td>/g));
  }
  console.log('PASS materials: current/all EN Excel, numbers unchanged');
  await open('sor-generator');
  assert.equal(await page.getByRole('button', {name:/英文/}).count(), 0);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS all English exports; SOR unchanged');
})().catch(async error => { console.error(error); if (browser) await browser.close(); process.exitCode = 1; });
