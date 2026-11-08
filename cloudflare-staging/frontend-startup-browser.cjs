// Solo fixture locale sintetica; nessun account o backup reale.
const {webkit,devices}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {READY_STARTUP}=await import('./frontend-startup.mjs');
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 for(const mobile of [false,true])for(const legacy of [true,false]){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tefinanza-startup-'));
  const context=await webkit.launchPersistentContext(dir,{headless:true,...(mobile?devices['iPhone 13']:{}),extraHTTPHeaders:{'x-native':'1','x-test-stage':'live','x-test-app':'tefinanza','x-test-user':(mobile?'b':'a').repeat(64)}});
  try{
   const page=await context.newPage();
   await page.route('**/purchases-ui.js*',async route=>{await new Promise(r=>setTimeout(r,2000));await route.continue();});
   if(legacy)await page.route('**/app.js*',route=>route.fulfill({contentType:'text/javascript',body:source.replace(READY_STARTUP,'initialize();')}));
   await page.goto(process.env.LUKI_STARTUP_URL||'http://127.0.0.1:18866/');
   if(legacy){await page.waitForFunction(()=>document.body.textContent.includes('archiveReportActive'));console.log(`${mobile?'iPhone':'Mac'}: difetto originale riprodotto`);}
   else{
    await page.waitForFunction(()=>window.tefinanzaIsReady===true);
    assert.equal(await page.evaluate(()=>document.body.textContent.includes("Can't find variable: archiveReportActive")),false);
    await page.evaluate(async()=>{const next=structuredClone(state);next.accounts[0].opening=42;await commit(next,[],{skipLocalArchive:true,skipDuplicateReview:true,skipCloud:true});});
    await page.reload();await page.waitForFunction(()=>window.tefinanzaIsReady===true);
    assert.equal(await page.evaluate(()=>state.accounts[0].opening),42);
    console.log(`${mobile?'iPhone':'Mac'}: avvio corretto e dati sintetici conservati al riavvio`);
   }
  }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true});}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
