const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--allow-file-access-from-files']});
 const p=await browser.newPage({viewport:{width:1500,height:1000}}),requests=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await p.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);await p.evaluate(()=>ElectricalToolkit.open('bolt'));
 assert.equal(await p.locator('[data-joint-field="calculationModel"]').count(),0,'no legacy algorithm selector');
 assert.match(await p.locator('[data-bolt-check="torque"] td').first().innerText(),/11\.17\b/);
 assert.ok(await p.locator('.bt-formula-steps .katex').count()>20,'all steps use real LaTeX');
 assert.ok(await p.locator('.bt-formula-steps mfrac').count()>10,'division is rendered as fractions');
 assert.equal(await p.locator('.math-error').count(),0);
 await p.evaluate(()=>window.print=()=>{});await p.locator('#btExportPdf').click();await p.waitForTimeout(200);
 assert.ok(await p.locator('#btPrint .katex').count()>20,'PDF uses the same LaTeX');
 await p.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await p.evaluate(()=>ElectricalToolkit.open('engineering-formulas'));
 let total=0;
 for(const tab of ['math','mechanics','electrical','thermal']){
  await p.locator(`.ef-tab[data-page="${tab}"]`).click();
  const cards=await p.locator('.ef-card').count();total+=cards;
  assert.ok(cards>=10,`${tab}: cards preserved`);
  assert.equal(await p.locator('.math-error').count(),0,`${tab}: valid LaTeX`);
  assert.equal(await p.locator('.ef-equations>div').count(),await p.locator('.ef-equations>div').filter({has:p.locator('.katex')}).count(),`${tab}: every equation typeset`);
  assert.ok(await p.locator('.ef-equations mfrac').count()>5,`${tab}: fractions present`);
 }
 assert.ok(total>=50);
 await p.locator('#ef-search').fill('肋片');assert.equal(await p.locator('.ef-card:visible').count(),1);
 await p.evaluate(()=>document.fonts.ready);assert.equal(await p.evaluate(()=>document.fonts.check('16px KaTeX_Main')),true);
 await p.setViewportSize({width:390,height:844});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'engineering equations scroll within their own blocks on narrow screens');
 assert.deepEqual(requests,[],'runtime stays offline');assert.deepEqual(errors,[]);
 await browser.close();console.log(`PASS offline LaTeX in bolt, PDF and ${total} engineering cards, fonts and search`);
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
