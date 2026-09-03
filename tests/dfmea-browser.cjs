const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
  await page.goto('file:///F:/Agent/Codex/Electrical_Web/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('.nav-item[data-id="dfmea"]').click();
  const counts = await page.locator('.df-counts b').allTextContents();
  assert.deepEqual(counts, ['46', '81', '91']);
  const widths = await page.locator('.df-table thead th').evaluateAll((cells) => cells.slice(0, 5).map((cell) => Math.round(cell.getBoundingClientRect().width)));
  assert.ok(widths[0] < 150 && widths[1] < 150 && widths[2] < 155, `C/D/E should be compact: ${widths}`);
  assert.ok(widths[4] >= 500, `G should be the widest content column: ${widths}`);
  await page.getByRole('button', { name: '加入全部系统需求' }).click();
  await page.getByRole('button', { name: '加入全部部件' }).click();
  await page.getByRole('button', { name: '加入全部子零件' }).click();
  assert.equal(await page.locator('#dfWorkBody tr').count(), 218);
  assert.match(await page.locator('#dfWorkCount').innerText(), /共 218 行/);
  const hierarchy = await page.evaluate(() => {
    const rows = window.DFMEA_LIBRARY.rows;
    const system = rows.filter((row) => row.level === 1);
    const l2 = rows.filter((row) => row.level === 2);
    const l3 = rows.filter((row) => row.level === 3);
    return {
      l2: l2.every((child) => system.some((parent) => parent.D === child.C && parent.G === child.F && parent.K === child.I)),
      l3: l3.every((child) => l2.some((parent) => parent.D === child.C && parent.G === child.F && parent.K === child.I)),
    };
  });
  assert.deepEqual(hierarchy, { l2: true, l3: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '按原模板导出DFMEA' }).click();
  const download = await downloadEvent;
  const output = path.join(__dirname, '..', 'tmp', 'dfmea-hierarchy-export.xlsx');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await download.saveAs(output);
  assert.ok(fs.statSync(output).size > 10000, 'expanded workbook was exported');
  fs.unlinkSync(output);
  await browser.close();
  console.log('PASS DFMEA browser hierarchy and 218-row export');
})().catch((error) => { console.error(error); process.exitCode = 1; });
