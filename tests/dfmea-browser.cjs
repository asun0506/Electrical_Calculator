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
  assert.deepEqual(counts, ['46', '87', '97']);
  const widths = await page.locator('.df-table thead th').evaluateAll((cells) => cells.slice(0, 5).map((cell) => Math.round(cell.getBoundingClientRect().width)));
  assert.ok(widths[0] < 150 && widths[1] < 150 && widths[2] < 155, `C/D/E should be compact: ${widths}`);
  assert.ok(widths[4] >= 500, `G should be the widest content column: ${widths}`);
  await page.getByRole('button', { name: '加入全部子零件' }).click();
  await page.getByRole('button', { name: '加入全部部件' }).click();
  await page.getByRole('button', { name: '加入全部系统需求' }).click();
  assert.equal(await page.locator('#dfWorkBody tr').count(), 230);
  assert.match(await page.locator('#dfWorkCount').innerText(), /共 230 行/);
  await page.getByRole('button', { name: '一键按层级/名称排序' }).click();
  const sorted = await page.locator('#dfWorkBody tr').evaluateAll((rows) => rows.map((row) => ({
    c: row.querySelector('[data-field="C"]').value,
    d: row.querySelector('[data-field="D"]').value,
    e: row.querySelector('[data-field="E"]').value,
  })));
  assert.ok(sorted.slice(0, 46).every((row) => row.c === ''), 'system rows should be first');
  assert.ok(sorted.slice(46, 133).every((row) => row.c === '电气系统'), 'component rows should be second');
  assert.ok(sorted.slice(133).every((row) => row.c && row.c !== '电气系统'), 'child rows should be third');
  const componentNames = sorted.slice(46, 133).map((row) => row.d);
  const expectedNames = [...componentNames].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' }));
  assert.deepEqual(componentNames, expectedNames, 'same component names should stay grouped');
  [sorted.slice(0, 46), sorted.slice(46, 133), sorted.slice(133)].forEach((levelRows) => {
    for (let index = 1; index < levelRows.length; index += 1) {
      const previous = levelRows[index - 1], current = levelRows[index];
      const dOrder = previous.d.localeCompare(current.d, 'zh-CN', { numeric: true, sensitivity: 'base' });
      const eOrder = previous.e.localeCompare(current.e, 'zh-CN', { numeric: true, sensitivity: 'base' });
      assert.ok(dOrder < 0 || (dOrder === 0 && eOrder <= 0), 'rows with the same D must be grouped by E');
    }
  });
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
  console.log('PASS DFMEA browser hierarchy and 230-row export');
})().catch((error) => { console.error(error); process.exitCode = 1; });
