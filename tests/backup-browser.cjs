const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => ElectricalToolkit.open('precharge'));
    assert.equal(await page.locator('[data-open-backups]').count(), 1, 'one global backup entry without global business project');
    await page.locator('#pc-v').fill('701'); await page.evaluate(() => ElectricalProjectController.newProject('另一个项目'));
    await page.locator('#pc-v').fill('702'); await page.evaluate(() => ElectricalToolkit.open('conductor'));
    await page.locator('#cd-packVoltage').fill('801'); await page.evaluate(() => ElectricalToolkit.open('bolt'));
    await page.locator('[data-open-backups]').click();
    assert.match(await page.locator('[data-backup-state]').textContent(), /未备份|尚未/);
    const snapshot = await page.evaluate(async () => (await ElectricalProjectController.captureWorkspace()).value);
    assert.equal(snapshot.projects.filter(x => x.moduleId === 'precharge').length, 2);
    assert.ok(snapshot.projects.some(x => x.moduleId === 'conductor' && x.payload.model.packVoltage === '801'));
    assert.ok(snapshot.shared.materials, 'shared user data included');
    const download = page.waitForEvent('download');
    assert.equal((await page.evaluate(() => ElectricalBackupUI.backupAll('zip'))).ok, true);
    const zip = await download; assert.match(zip.suggestedFilename(), /\.zip$/);
    assert.match(await page.locator('[data-backup-state]').textContent(), /已生成.*确认.*保存/);
    assert.doesNotMatch(await page.locator('[data-backup-state]').textContent(), /磁盘备份成功/);
    // Hold only the external writer, keep actual capture/pack code running.
    await page.evaluate(() => {
      const real = ElectricalBackupIO.createBackupIO(window);
      ElectricalBackupUI.mount({ controller: ElectricalProjectController, store: ElectricalProjectController.store, format: ElectricalBackupFormat, adapters: ElectricalProjectAdapters,
        io: { ...real, writeDirectory: async files => { window.__frozenFiles = files; await new Promise(resolve => { window.__finishBackup = resolve; }); return { ok: true, value: { directoryName: 'test-snapshot' } }; } } });
      window.__backupResult = ElectricalBackupUI.backupAll('directory');
    });
    await page.waitForFunction(() => !!window.__finishBackup);
    await page.locator('dialog[open] [data-close-backups]').click();
    await page.locator('[data-meta=projectName]').fill('备份进行中的新编辑');
    await page.evaluate(() => window.__finishBackup());
    assert.equal((await page.evaluate(() => window.__backupResult)).ok, true);
    await page.locator('[data-open-backups]').click();
    assert.match(await page.locator('[data-backup-state]').textContent(), /新修改未备份/);
    const frozen = await page.evaluate(async () => { const checked = await ElectricalBackupFormat.inspect(window.__frozenFiles, { adapters: ElectricalProjectAdapters }); return checked.value.validProjects.find(x => x.moduleId === 'bolt').payload.model.meta.projectName; });
    assert.notEqual(frozen, '备份进行中的新编辑');
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('quota'); }; IDBObjectStore.prototype.put = () => { throw Error('quota'); }; });
    await page.locator('[data-close-backups]').click();
    await page.locator('[data-meta=projectName]').fill('内存未保存也要备份');
    const unsaved = await page.evaluate(async () => (await ElectricalProjectController.captureWorkspace()));
    assert.equal(unsaved.ok, true); assert.equal(unsaved.value.browserUnsaved, true);
    assert.equal(unsaved.value.projects.find(x => x.moduleId === 'bolt').payload.model.meta.projectName, '内存未保存也要备份');
    assert.deepEqual(errors, []);
    console.log('PASS backup controls: complete working set, untouched modules, ZIP download semantics, frozen snapshots, new dirty edits and quota-safe memory export');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
