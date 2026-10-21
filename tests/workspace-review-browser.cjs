const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => ElectricalToolkit.open('precharge'));
    const ids = await page.evaluate(async () => {
      const c = ElectricalProjectController, a = c.currentProject().id;
      await c.newProject('B'); const b = c.currentProject().id; await c.open('precharge', a); await c.flush();
      const original = c.store.commit;
      c.store.commit = async (...args) => { await new Promise(resolve => { window.releaseSwitch = resolve; }); c.store.commit = original; return original(...args); };
      window.switching = c.open('precharge', b); return { a, b };
    });
    await page.waitForFunction(() => !!window.releaseSwitch);
    const switchingState = await page.evaluate(() => {
      const node = document.querySelector('#pc-v'); node.value = '999'; node.dispatchEvent(new Event('input', { bubbles: true }));
      return node.closest('.calc-body').inert;
    });
    await page.evaluate(() => window.releaseSwitch()); await page.evaluate(() => window.switching);
    await page.evaluate(() => ElectricalProjectController.flush());
    await page.evaluate(id => ElectricalProjectController.open('precharge', id), ids.a);
    await page.evaluate(id => ElectricalProjectController.open('precharge', id), ids.b);
    assert.equal(await page.locator('#pc-v').inputValue(), '999', 'intervening changes must not be falsely marked saved');
    assert.equal(switchingState, true, 'target remains inert through durable commit');
    assert.equal(await page.evaluate(() => ElectricalToolkit.get('materials').validateShared({ overrides: {}, customs: { Bad: null } }).ok), false, 'malformed shared material rejected before write');
    await page.evaluate(() => ElectricalToolkit.open('dfmea'));
    assert.equal(await page.evaluate(() => {
      const c = ElectricalProjectController, payload = structuredClone(c.currentProject().payload); payload.model.query = { bad: true };
      return ElectricalProjectAdapters.get('dfmea').validate(payload).ok;
    }), false, 'render-consumed DFMEA fields validated');
    // Async exports must cancel instead of using a newly mounted project.
    const exportFailures = [];
    for (const [moduleId, button] of [['sor-generator', '#sorWord'], ['dfmea', '#dfExportXlsx']]) {
      await page.evaluate(id => ElectricalToolkit.open(id), moduleId);
      if (moduleId === 'dfmea') await page.locator('#dfAddBlank').click();
      await page.evaluate(() => {
        window.exportAlerts = []; window.alert = value => window.exportAlerts.push(value); window.exportDownloads = [];
        HTMLAnchorElement.prototype.click = function () { window.exportDownloads.push(this.download); };
        const original = JSZip.loadAsync;
        JSZip.loadAsync = async (...args) => { await new Promise(resolve => { window.releaseExport = resolve; }); JSZip.loadAsync = original; return original.apply(JSZip, args); };
      });
      await page.locator(button).click(); await page.waitForFunction(() => !!window.releaseExport);
      await page.evaluate(() => ElectricalProjectController.newProject('切换后的项目'));
      await page.evaluate(() => window.releaseExport());
      await page.waitForFunction(() => window.exportAlerts.length > 0 || window.exportDownloads.length > 0);
      try {
        assert.deepEqual(await page.evaluate(() => window.exportDownloads), [], moduleId + ' must not download another project');
        assert.match((await page.evaluate(() => window.exportAlerts)).join(' '), /切换|取消/);
      } catch (error) { exportFailures.push(error.message); }
      await page.evaluate(() => { delete window.releaseExport; });
    }
    assert.deepEqual(exportFailures, []);
    await page.evaluate(() => ElectricalToolkit.open('sor-generator'));
    await page.evaluate(() => {
      window.printCount = 0; window.print = () => { window.printCount++; };
      window.docx.renderAsync = async (_blob, host) => { host.textContent = 'test preview'; };
      const original = window.setTimeout;
      window.setTimeout = (callback, delay, ...args) => delay === 300 ? (window.pendingPrint = callback, 0) : original(callback, delay, ...args);
    });
    await page.locator('#sorPdf').click(); await page.waitForFunction(() => !!window.pendingPrint);
    await page.evaluate(() => ElectricalProjectController.newProject('打印等待期间的新项目'));
    await page.evaluate(() => window.pendingPrint());
    assert.equal(await page.evaluate(() => window.printCount), 0, 'delayed print must not print a newly switched project');
    console.log('PASS final-review regressions: delayed navigation, shared/model validation and asynchronous export isolation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
