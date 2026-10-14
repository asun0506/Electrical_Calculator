const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--allow-file-access-from-files']});
  try{
    const page=await browser.newPage({acceptDownloads:true});page.on('dialog',d=>d.accept());
    await page.goto(pathToFileURL(path.join(__dirname,'..','index.html')).href);
    await page.evaluate(()=>ElectricalToolkit.open('dvpr'));
    await page.locator('[data-product="fpc"]').evaluate(el=>el.closest('details').open=true);
    await page.locator('[data-product="fpc"]').check();
    await page.locator('#dvRecommend').click();await page.locator('#dvGenerate').click();
    const generated=await page.evaluate(()=>ElectricalToolkit.get('dvpr').captureDraft().rows);
    const thermal=generated.filter(r=>/温升/.test(r.testItem));
    assert.equal(thermal.length,1,'FPC temperature-rise references generate one consolidated test');
    assert.match(thermal[0].standard,/内部数据库/);assert.match(thermal[0].standard,/IPC-2152/);
    const overload=generated.filter(r=>r.testItem==='保险丝过流');
    assert.equal(overload.length,2,'5 A and 8 A overcurrent experiments remain distinct');
    assert.ok(overload.some(r=>/5A/.test(r.procedure))&&overload.some(r=>/8A/.test(r.procedure)));
    await page.locator('#dvGenerate').click();
    const repeated=await page.evaluate(()=>ElectricalToolkit.get('dvpr').captureDraft().rows);
    assert.deepEqual(repeated,generated,'repeated generation does not grow rows or requirements');
    // Simulate an old workspace with duplicate names across standards and evidence.
    await page.evaluate(()=>{
      const calc=ElectricalToolkit.get('dvpr'),saved=calc.captureDraft();
      saved.rows=[{id:'old1',productId:'fpc',productName:'FPC',testItem:'耐盐雾要求',standard:'内部数据库',sampleQty:'3',acceptance:'无开路',attachments:[{name:'evidence.txt',type:'text/plain',size:1,dataUrl:'data:text/plain;base64,YQ=='}]},
        {id:'old2',productId:'fpc',productName:'FPC',testItem:'盐雾试验',standard:'ISO 9227:2022',sampleQty:'5',acceptance:'满足图纸',attachments:[]}];
      calc.restoreDraft(saved);
    });
    await page.locator('#dvMergeRows').click();
    assert.equal(await page.locator('#dvRows tr[data-row]').count(),1);
    const event=page.waitForEvent('download');await page.locator('#dvJsonExport').click();
    const file=await event,filePath=path.join(__dirname,'..','tmp','dvpr-merged-test.json');await file.saveAs(filePath);
    let payload;try{payload=JSON.parse(fs.readFileSync(filePath,'utf8'));}finally{fs.unlinkSync(filePath);}
    assert.equal(payload.rows.length,1);assert.equal(payload.rows[0].mergeSources.length,2);
    assert.equal(payload.rows[0].attachments.length,1);
    await page.locator('#dvJsonImport').setInputFiles({name:'merged.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
    assert.equal(await page.locator('#dvRows tr[data-row]').count(),1,'merged provenance survives JSON import');
    await page.locator('#dvMergeRows').click();
    assert.equal(await page.locator('#dvRows tr[data-row]').count(),1);
    // All export routes prepare the same merged workspace, including edited legacy rows.
    await page.evaluate(()=>{const calc=ElectricalToolkit.get('dvpr'),saved=calc.captureDraft();saved.rows.push({...saved.rows[0],id:'duplicate'});calc.restoreDraft(saved);});
    const secondEvent=page.waitForEvent('download');await page.locator('#dvJsonExport').click();
    const second=await secondEvent;await second.saveAs(filePath);
    try{assert.equal(JSON.parse(fs.readFileSync(filePath,'utf8')).rows.length,1,'export automatically removes duplicates');}finally{fs.unlinkSync(filePath);}
    console.log(`PASS DVP consolidated generation/export and legacy JSON: ${generated.length} FPC rows`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
