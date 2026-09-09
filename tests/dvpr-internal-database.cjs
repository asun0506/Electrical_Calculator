const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
let browser;
(async () => {
  browser = await chromium.launch({ executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless:true, args:['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport:{width:1600,height:1000} });
  const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(()=>localStorage.clear()); await page.reload();
  await page.evaluate(()=>ElectricalToolkit.open('dvpr'));
  await page.waitForSelector('[data-product="electric-swap-connector"]');
  const audit=await page.evaluate(()=>({
    internalTotal:Object.values(DVPR_LIBRARY.internalSourceStats).reduce((sum,n)=>sum+n,0),
    products:DVPR_LIBRARY.products.length,
    sourceProducts:DVPR_INTERNAL_LIBRARY.products.length,
    swapInternal:DVPR_LIBRARY.profiles['electric-swap-connector'].filter((r)=>r[1]==='内部数据库').length,
    allRecommended:DVPR_LIBRARY.products.every((p)=>p.recommendedStandards.includes('内部数据库')),
    hasNonNumericSample:Object.values(DVPR_INTERNAL_LIBRARY.profiles).flat().some((r)=>!/^[0-9]+$/.test(String(r[3]))),
  }));
  assert.equal(audit.internalTotal,446,'all workbook validation records are loaded');
  assert.equal(audit.sourceProducts,25,'all source worksheet product groups are mapped');
  assert.ok(audit.products>=38,'existing and internal product catalogs are merged');
  assert.ok(audit.swapInternal>=40,'electric swap connector retains its full internal DV set');
  assert.equal(audit.allRecommended,true,'internal database is recommended for every product');
  assert.equal(audit.hasNonNumericSample,true,'ALL/full sample definitions are retained');
  assert.equal(await page.locator('[data-standard="内部数据库"]').isChecked(),true,'internal database is checked by default');
  await page.locator('[data-product="electric-swap-connector"]').check();
  await page.getByRole('button',{name:'选择推荐标准'}).click();
  assert.equal(await page.locator('[data-standard="内部数据库"]').isChecked(),true);
  page.once('dialog',(dialog)=>dialog.dismiss());
  await page.getByRole('button',{name:'生成/补充验证矩阵'}).click();
  await page.waitForTimeout(100);
  const generatedInternal=await page.locator('#dvRows tr[data-row]').filter({has:page.locator('[data-field="standard"]')}).count();
  assert.ok(generatedInternal>=40,'large internal matrix renders');
  assert.deepEqual(errors,[]);
  await browser.close();
  console.log(`PASS internal DV database: ${audit.internalTotal} rows, ${audit.products} products`);
})().catch(async(error)=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});
