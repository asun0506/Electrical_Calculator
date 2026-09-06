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
  assert.deepEqual(counts, ['58', '245']);
  const widths = await page.locator('.df-table thead th').evaluateAll((cells) => cells.slice(0, 5).map((cell) => Math.round(cell.getBoundingClientRect().width)));
  assert.ok(widths[0] < 150 && widths[1] < 150 && widths[2] < 155, `C/D/E should be compact: ${widths}`);
  assert.ok(widths[4] >= 500, `G should be the widest content column: ${widths}`);
  await page.getByRole('button', { name: '加入全部部件分析' }).click();
  await page.getByRole('button', { name: '加入全部系统需求' }).click();
  assert.equal(await page.locator('#dfWorkBody tr').count(), 303);
  assert.match(await page.locator('#dfWorkCount').innerText(), /共 303 行/);
  await page.getByRole('button', { name: '一键按层级/名称排序' }).click();
  const sorted = await page.locator('#dfWorkBody tr').evaluateAll((rows) => rows.map((row) => ({
    c: row.querySelector('[data-field="C"]').value,
    d: row.querySelector('[data-field="D"]').value,
    e: row.querySelector('[data-field="E"]').value,
  })));
  assert.ok(sorted.slice(0, 58).every((row) => row.c === ''), 'system rows should be first');
  assert.ok(sorted.slice(58).every((row) => row.c === '电气系统'), 'integrated component rows should be second');
  const componentNames = sorted.slice(58).map((row) => row.d);
  const expectedNames = [...componentNames].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true, sensitivity: 'base' }));
  assert.deepEqual(componentNames, expectedNames, 'same component names should stay grouped');
  [sorted.slice(0, 58), sorted.slice(58)].forEach((levelRows) => {
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
    return {
      l2: l2.every((child) => system.some((parent) => parent.D === child.C && parent.G === child.F && parent.K === child.I)),
      noL3: rows.every((row) => row.level !== 3),
      integrated: l2.filter((row) => row.E).every((row) => row.H && row.L),
    };
  });
  assert.deepEqual(hierarchy, { l2: true, noL3: true, integrated: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '按原模板导出DFMEA' }).click();
  const download = await downloadEvent;
  const output = path.join(__dirname, '..', 'tmp', 'dfmea-hierarchy-export.xlsx');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await download.saveAs(output);
  assert.ok(fs.statSync(output).size > 10000, 'expanded workbook was exported');
  fs.unlinkSync(output);
  const migrated = await page.evaluate(() => {
    const base = window.DFMEA_LIBRARY.rows.find((row) => row.level === 2 && row.E);
    const oldChild = {
      id: 'OLD-L3', level: 3, C: base.D, D: base.E, F: base.G, G: base.H,
      I: base.K, J: base.J, K: base.L, M: base.M, N: base.N, O: base.O, P: base.P,
    };
    window.ElectricalToolkit.get('dfmea').restoreDraft({ version: 6, level: '3', rows: [oldChild] });
    const row = document.querySelector('#dfWorkBody tr');
    return {
      count: document.querySelectorAll('#dfWorkBody tr').length,
      levelFilter: document.querySelector('#dfLevel').value,
      c: row.querySelector('[data-field="C"]').value,
      d: row.querySelector('[data-field="D"]').value,
      e: row.querySelector('[data-field="E"]').value,
      expected: { c: base.C, d: base.D, e: base.E },
    };
  });
  assert.deepEqual(migrated, { count: 1, levelFilter: '2', ...migrated.expected, expected: migrated.expected });
  await browser.close();
  console.log('PASS DFMEA browser two-level hierarchy and 303-row export');
})().catch((error) => { console.error(error); process.exitCode = 1; });
