const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.evaluate(() => ElectricalToolkit.open('precharge')); await page.locator('#pc-v').fill('750');
    const originalId = await page.locator('[data-project-select]').inputValue();
    const zipBytes = await page.evaluate(async () => {
      const snapshot = (await ElectricalProjectController.captureWorkspace()).value;
      const packed = await ElectricalBackupFormat.pack(snapshot);
      const io = ElectricalBackupIO.createBackupIO(window), zip = await io.createZip(packed.value.files);
      return [...new Uint8Array(await zip.value.arrayBuffer())];
    });
    await page.locator('#pc-v').fill('410'); await page.evaluate(() => ElectricalToolkit.flush());
    await page.locator('[data-open-backups]').click();
    await page.locator('[data-backup-import]').setInputFiles({ name: 'snapshot.zip', mimeType: 'application/zip', buffer: Buffer.from(zipBytes) });
    await page.waitForSelector('[data-restore-project]');
    assert.equal(await page.locator('[data-restore-mode]').inputValue(), 'copy');
    const before = await page.evaluate(() => ElectricalProjectController.workspace().revision);
    assert.equal(await page.locator('[data-restore-shared]').isChecked(), false);
    await page.locator('[data-close-backups]').click();
    assert.equal(await page.evaluate(() => ElectricalProjectController.workspace().revision), before, 'cancel preview causes no writes');
    await page.locator('[data-open-backups]').click();
    await page.locator('[data-backup-import]').setInputFiles({ name: 'snapshot.zip', mimeType: 'application/zip', buffer: Buffer.from(zipBytes) });
    await page.waitForSelector('[data-restore-project]');
    await page.locator('[data-restore-apply]').click();
    await page.waitForFunction(() => ElectricalProjectController.projects().length === 2);
    await page.locator('[data-close-backups]').click();
    assert.equal(await page.locator('#pc-v').inputValue(), '410', 'copy restore does not overwrite active project');
    const copyId = await page.evaluate(original => ElectricalProjectController.projects().find(item => item.id !== original).id, originalId);
    await page.locator('[data-project-select]').selectOption(copyId); await page.waitForFunction(() => document.querySelector('#pc-v')?.value === '750');
    await page.locator('[data-project-select]').selectOption(originalId); await page.waitForFunction(() => document.querySelector('#pc-v')?.value === '410');
    await page.locator('[data-open-backups]').click();
    await page.locator('[data-backup-import]').setInputFiles({ name: 'snapshot.zip', mimeType: 'application/zip', buffer: Buffer.from(zipBytes) });
    await page.waitForSelector('[data-restore-project]'); await page.locator('[data-restore-mode]').selectOption('replace');
    await page.locator('[data-restore-target]').selectOption(originalId);
    await page.locator('[data-restore-apply]').click();
    await page.waitForFunction(() => ElectricalProjectController.readDraft('precharge').form.find(x => x.id === 'pc-v').value === '750');
    await page.waitForSelector('[data-recovery-rollback]'); await page.locator('[data-recovery-rollback]').first().click();
    await page.waitForFunction(() => ElectricalProjectController.readDraft('precharge').form.find(x => x.id === 'pc-v').value === '410');
    await page.locator('[data-close-backups]').click();
    await page.reload(); await page.waitForSelector('#pc-v'); assert.equal(await page.locator('#pc-v').inputValue(), '410');
    const beforeFailure = await page.evaluate(() => ElectricalProjectController.workspace());
    const failedBatch = await page.evaluate(async bytes => {
      const transport = ElectricalBackupIO.createBackupIO(window), read = await transport.readZip(new Uint8Array(bytes));
      const inspected = await ElectricalBackupFormat.inspect(read.value, { adapters: ElectricalProjectAdapters });
      const originalPut = IDBObjectStore.prototype.put;
      Storage.prototype.setItem = () => { throw Error('quota'); };
      IDBObjectStore.prototype.put = function(value) {
        const result = originalPut.call(this, value);
        if (this.name === 'records' && value.id === 'workspace') this.transaction.abort();
        return result;
      };
      return ElectricalProjectController.applyRestore(inspected.value, { mode: 'copy' });
    }, zipBytes);
    assert.equal(failedBatch.ok, false);
    assert.deepEqual(await page.evaluate(() => ElectricalProjectController.workspace()), beforeFailure, 'aborted real IDB batch plus local quota leaves every existing project unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS backup restore UI: ZIP preview/cancel, default copy, explicit replacement, recovery-point rollback and reload');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
