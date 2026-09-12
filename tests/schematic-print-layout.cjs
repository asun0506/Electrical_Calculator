const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--allow-file-access-from-files']});
  const page=await browser.newPage({viewport:{width:1800,height:1100}});page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.evaluate(()=>localStorage.clear());await page.reload();await page.evaluate(()=>ElectricalToolkit.open('schematic'));
  await page.locator('#schSheetSize').selectOption('A2');await page.evaluate(()=>{window.print=()=>{};});await page.locator('#schExportPdf').click();await page.waitForTimeout(250);await page.emulateMedia({media:'print'});
  const out=path.join(root,'output','pdf');fs.mkdirSync(out,{recursive:true});
  await page.pdf({path:path.join(out,'electrical-schematic-sample.pdf'),width:'594mm',height:'420mm',printBackground:true,preferCSSPageSize:true,margin:{top:'5mm',right:'5mm',bottom:'5mm',left:'5mm'}});
  await browser.close();console.log('Created output/pdf/electrical-schematic-sample.pdf');
})().catch(e=>{console.error(e);process.exitCode=1;});
