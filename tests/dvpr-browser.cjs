const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const JSZip = require('jszip');

const root = path.resolve(__dirname, '..');
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless:true, args:['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport:{width:1600,height:1000}, acceptDownloads:true });
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(()=>localStorage.clear()); await page.reload();
  await page.evaluate(()=>ElectricalToolkit.open('dvpr'));
  await page.waitForSelector('[data-product="hv-connector"]');

  const audit=await page.evaluate(()=>({
    products:DVPR_LIBRARY.products.map(p=>p.id),
    profiles:Object.fromEntries(Object.entries(DVPR_LIBRARY.profiles).map(([id,rows])=>[id,rows.length])),
    mappings:DVPR_LIBRARY.mappings,
  }));
  ['cu-busbar','al-busbar','hv-cable','fpc','plastic','lv-harness','relay','pyro-fuse','thermal-fuse','precharge-resistor','pcb','hv-connector','lv-connector','crimp-terminal','shunt','hall-sensor','fuse-box'].forEach(id=>assert.ok(audit.products.includes(id),`missing ${id}`));
  assert.ok(Object.values(audit.profiles).every(count=>count>=12),'each product has common plus specific tests');
  assert.ok(audit.mappings.every(m=>m.equivalent===false),'mapping must explicitly reject equivalence');

  await page.locator('[data-product="hv-connector"]').check();
  await page.locator('[data-product="relay"]').check();
  await page.getByRole('button',{name:'选择推荐标准'}).click();
  const selectedStandards=await page.locator('[data-standard]:checked').count();
  assert.ok(selectedStandards>=6,'recommended standards selected');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'生成/补充验证矩阵'}).click();
  await page.waitForTimeout(100);
  const initialRows=await page.locator('#dvRows tr[data-row]').count();
  assert.ok(initialRows>=20,'matrix generated for two products');

  const first=page.locator('#dvRows tr[data-row]').first();
  await first.locator('[data-field="owner"]').fill('Test Owner');
  await first.locator('[data-field="status"]').selectOption('进行中');
  await first.locator('[data-attach]').setInputFiles({name:'DV-report.txt',mimeType:'text/plain',buffer:Buffer.from('verification evidence')});
  await first.getByText(/DV-report\.txt/).waitFor();
  assert.match(await first.innerText(),/DV-report\.txt/);

  const firstItem=first.locator('[data-field="testItem"]');
  await firstItem.focus();
  await firstItem.evaluate((el)=>{
    const data=new DataTransfer();data.setData('text/plain','粘贴试验A\t项目技术规范\t章节A\n粘贴试验B\tIEC 60512\t章节B');
    el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  });
  assert.equal(await page.locator('#dvRows tr[data-row]').nth(1).locator('[data-field="testItem"]').inputValue(),'粘贴试验B');

  const outputDir=path.join(root,'tmp');fs.mkdirSync(outputDir,{recursive:true});
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出Excel'}).click();const file=await downloadEvent;const xlsxPath=path.join(outputDir,'dvpr-test.xlsx');await file.saveAs(xlsxPath);
  const zip=await JSZip.loadAsync(fs.readFileSync(xlsxPath));
  const workbookXml=await zip.file('xl/workbook.xml').async('string');
  assert.match(workbookXml,/name="DVP&amp;R"/);assert.match(workbookXml,/name="标准映射提示"/);
  const xmlParts=await Promise.all(Object.keys(zip.files).filter(name=>/^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(name)).map(name=>zip.file(name).async('string')));
  const xlsxText=xmlParts.join('\n');assert.match(xlsxText,/DVP&amp;R \/ 设计验证计划与报告/);assert.match(xlsxText,/DV-report\.txt/);assert.match(xlsxText,/粘贴试验A/);
  fs.unlinkSync(xlsxPath);

  const jsonEvent=page.waitForEvent('download');await page.getByRole('button',{name:'导出JSON'}).click();const jsonDownload=await jsonEvent;const jsonPath=path.join(outputDir,'dvpr-test.json');await jsonDownload.saveAs(jsonPath);
  const exported=JSON.parse(fs.readFileSync(jsonPath,'utf8'));assert.ok(exported.rows[0].attachments[0].dataUrl.startsWith('data:text/plain;base64,'));fs.unlinkSync(jsonPath);

  await page.evaluate(()=>{window.print=()=>{window.__dvprPrinted=true;};});
  await page.getByRole('button',{name:'导出PDF'}).click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__dvprPrinted),true);assert.match(await page.locator('.dv-print-shell').innerText(),/标准映射说明/);
  assert.deepEqual(errors,[]);
  await browser.close();console.log(`PASS DVP&R: ${initialRows} generated rows, Excel/JSON/PDF paths verified`);
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});
