const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => ElectricalToolkit.open('busbar-temp'));
    // This map has RMS sqrt(75) = 8.660..., distinct from its average 7.5 A.
    await page.locator('#bb-ta').fill('10\t0\n11\t10\n12\t10');
    const currentChart = page.locator('#bb-result .normal-chart-wrap').first();
    assert.match(await currentChart.textContent(), /RMS 有效电流 8\.66 A/);
    assert.doesNotMatch(await currentChart.textContent(), /平均电流/);
    assert.match(await page.locator('#bb-result').textContent(), /平均电流/,
      'average remains available in result cards');

    const rmsLine = currentChart.locator('svg line[stroke="#16a34a"][stroke-dasharray]').first();
    const rmsY = Number(await rmsLine.getAttribute('y1'));
    // Linear chart: top 34, bottom 46, 8% padding gives range [-0.8, 10.8].
    assert.ok(Math.abs(rmsY - (34 + (10.8 - Math.sqrt(75)) / 11.6 * 280)) < 0.11,
      'horizontal reference uses RMS, not only an RMS label on the average line');

    const currentName = '工况 <img src=x onerror=alert(1)> & 电流';
    const temperatureName = '测试工况温升';
    await page.locator('#bb-current-title').fill(currentName);
    await page.locator('#bb-temperature-title').fill(temperatureName);
    assert.equal(await currentChart.locator('.chart-title').textContent(), currentName);
    assert.equal(await currentChart.locator('.chart-title img').count(), 0, 'title renders as inert text');
    assert.equal(await page.locator('#bb-result .chart-title').nth(1).textContent(), temperatureName);

    await page.evaluate(() => ElectricalToolkit.open('precharge'));
    await page.evaluate(() => ElectricalToolkit.open('busbar-temp'));
    assert.equal(await page.locator('#bb-current-title').inputValue(), currentName);
    assert.equal(await page.locator('#bb-result .chart-title').first().textContent(), currentName);
    await page.waitForFunction(() => {
      const saved = CalculatorDrafts.read('busbar-temp');
      return saved?.form?.some(item => item.id === 'bb-temperature-title' && item.value === '测试工况温升');
    });
    await page.reload();
    await page.waitForSelector('#bb-current-title');
    assert.equal(await page.locator('#bb-current-title').inputValue(), currentName);
    assert.equal(await page.locator('#bb-temperature-title').inputValue(), temperatureName);
    assert.equal(await page.locator('#bb-result .chart-title').nth(1).textContent(), temperatureName);

    await page.locator('#bb-current-title').fill('   ');
    await page.locator('#bb-temperature-title').fill('');
    assert.match(await page.locator('#bb-result .chart-title').first().textContent(), /电流–时间曲线/);
    assert.match(await page.locator('#bb-result .chart-title').nth(1).textContent(), /汇流排温升曲线/);
    console.log('PASS busbar RMS reference, custom chart names, inert text and draft persistence');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
