// Test locale sintetico: nessuna sessione o dato personale, nessun deploy.
const {webkit,devices}=require('playwright');const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=__dirname,app=JSON.parse(fs.readFileSync(path.join(dir,'deployment.json'),'utf8')).app,port=Number(process.env.LUKI_TEST_PORT||18766),origin='http://127.0.0.1:'+port;
const key=Buffer.from(Uint8Array.from({length:32},(_,i)=>i)).toString('base64url');
const user=crypto.createHash('sha256').update('synthetic-'+crypto.randomUUID()).digest('hex');
const server=cp.spawn(process.execPath,[path.join(dir,'browser-server.mjs')],{env:{...process.env,LUKI_TEST_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const ready=new Promise((ok,no)=>{server.stdout.on('data',d=>{if(String(d).includes('ready'))ok();});server.once('exit',code=>no(Error('server exited '+code)));server.stderr.on('data',d=>process.stderr.write(d));});
const make=async(profile,options,testUser=user)=>{const context=await webkit.launchPersistentContext(profile,{headless:true,...options,extraHTTPHeaders:{'x-test-app':app,'x-test-user':testUser,'x-test-stage':'live'}});await context.addInitScript(()=>{window.tefinanzaIsReady=true;window.syncReady=true;window.uploadsPending=false;window.backupBusy=false;window.syncDirty=false;window.dirty=false;window.busy=false;window.setInterval=()=>0;});return context;};
async function pageOf(context){const page=context.pages()[0]||await context.newPage();await page.goto(origin);await page.waitForFunction(()=>!!window.LukiSyncTest);await page.evaluate(()=>fixtureReady);return page;}
async function link(page){await page.evaluate(()=>document.getElementById('luki-unlock').click());await page.getByLabel('Chiave di sincronizzazione di questa app',{exact:true}).fill(key);await page.getByRole('button',{name:'Sblocca con questa chiave',exact:true}).click();await page.locator('#luki-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>!!LukiSyncTest.getKey());}
async function revision(page,value){await page.waitForFunction(n=>LukiStorage.readControl().baseRevision>=n,value);}
async function idle(page){for(let i=0;i<3;i++){try{await page.evaluate(()=>LukiSyncTest.resumeAndSync());await page.waitForFunction(()=>!!window.LukiSyncTest?.getKey()&&!document.body.inert);return;}catch(error){if(!/Execution context was destroyed|navigation/.test(error.message))throw error;await page.waitForFunction(()=>!!window.LukiSyncTest?.getKey()&&!document.body.inert);}}throw Error('Repeated unexpected reloads');}
async function sync(page){await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(3100);await idle(page);}
async function restore(page){const before=await page.evaluate(()=>LukiStorage.generation);page.once('dialog',d=>d.accept());await page.evaluate(()=>document.getElementById('luki-history').click());await page.getByRole('button',{name:'Verifica e usa sul dispositivo',exact:true}).first().click();await page.waitForFunction(before=>LukiStorage.generation!==before&&!document.body.inert&&!!window.LukiSyncTest?.getKey(),before);}
(async()=>{const contexts=[];try{
 await ready;
 const macPath=fs.mkdtempSync('/tmp/luki-device-mac-'),phonePath=fs.mkdtempSync('/tmp/luki-device-phone-');
 let mac=await make(macPath,{viewport:{width:1440,height:900}});contexts.push(mac);let a=await pageOf(mac);
 await a.evaluate(()=>fixturePut({note:'SYNTHETIC MAC'},'synthetic attachment'));
 await link(a);await revision(a,1);
 assert.equal(await a.evaluate(async()=>{const k=await LukiSyncTest.deviceKeys.load();try{await crypto.subtle.exportKey('raw',k);return true;}catch{return false;}}),false);
 const snapshot=await a.evaluate(()=>LukiSyncTest.capture());assert(!JSON.stringify(snapshot).includes('device-key'));assert(!JSON.stringify(snapshot).includes(key));
 // Advance the browser clock by a day: the original 15-minute timeout must not recur.
 await a.evaluate(()=>{const old=Date.now;Date.now=()=>old()+86400000;});await a.evaluate(()=>fixturePut({note:'SYNTHETIC AFTER DAY'}));await sync(a);await revision(a,2);
 await mac.close();
 mac=await make(macPath,{viewport:{width:1440,height:900}});contexts.push(mac);a=await pageOf(mac);await a.waitForFunction(()=>!!LukiSyncTest.getKey());assert.equal(await a.evaluate(()=>fixtureRead().then(x=>x.note)),'SYNTHETIC AFTER DAY');
 await a.evaluate(()=>fixturePut({note:'SYNTHETIC REOPEN MAC'}));await sync(a);await revision(a,3);
 // iPhone pairs once and explicitly chooses the existing cloud revision.
 let phone=await make(phonePath,devices['iPhone 13']);contexts.push(phone);let b=await pageOf(phone);await link(b);await restore(b);await b.waitForFunction(async()=> (await fixtureRead())?.note==='SYNTHETIC REOPEN MAC');
 await phone.close();phone=await make(phonePath,devices['iPhone 13']);contexts.push(phone);b=await pageOf(phone);await b.waitForFunction(()=>!!LukiSyncTest.getKey());
 await b.evaluate(()=>fixturePut({note:'SYNTHETIC REOPEN IPHONE'}));await sync(b);await revision(b,4);
 await sync(a);await a.waitForFunction(async()=> (await fixtureRead())?.note==='SYNTHETIC REOPEN IPHONE');
 // Simulate Safari suspension/BFCache: pagehide clears RAM; pageshow restores and syncs.
 await idle(a);await a.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await a.evaluate(()=>LukiSyncTest.getKey()),null);
 await b.evaluate(()=>fixturePut({note:'SYNTHETIC WHILE MAC SUSPENDED'}));await sync(b);await revision(b,5);
 await a.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await a.waitForFunction(()=>!!LukiSyncTest.getKey());await sync(a);await a.waitForFunction(async()=> (await fixtureRead())?.note==='SYNTHETIC WHILE MAC SUSPENDED');
 await a.goto('about:blank');await a.goBack();await a.waitForFunction(()=>!!window.LukiSyncTest?.getKey());
 // A transient session failure cannot upload or remove the persisted credential.
 await a.evaluate(()=>LukiSyncTest.resumeAndSync());await a.route('**/_sync/session',r=>r.fulfill({status:503,json:{error:'synthetic offline'}}));await a.evaluate(()=>LukiSyncTest.resumeAndSync());assert.equal(await a.evaluate(()=>LukiSyncTest.getKey()),null);assert.equal(await a.evaluate(async()=>!!await LukiSyncTest.deviceKeys.load()),true);await a.unroute('**/_sync/session');await a.evaluate(()=>window.dispatchEvent(new Event('online')));await a.waitForFunction(()=>!!LukiSyncTest.getKey());
 await a.evaluate(()=>LukiSyncTest.resumeAndSync());await a.route('**/_sync/session',r=>r.fulfill({status:401,json:{error:'synthetic expired session'}}));await a.evaluate(()=>LukiSyncTest.resumeAndSync());assert.equal(await a.evaluate(()=>LukiSyncTest.getKey()),null);assert.equal(await a.evaluate(async()=>!!await LukiSyncTest.deviceKeys.load()),true);await a.unroute('**/_sync/session');await a.reload();await a.waitForFunction(()=>!!LukiSyncTest.getKey());
 // A different authenticated account on the same browser cannot reuse the key.
 await mac.setExtraHTTPHeaders({'x-test-app':app,'x-test-user':'f'.repeat(64),'x-test-stage':'live'});await a.reload();await a.waitForFunction(()=>!!window.LukiSyncTest);await a.evaluate(()=>LukiSyncTest.resumeAndSync());assert.equal(await a.evaluate(()=>LukiSyncTest.getKey()),null);
 await mac.setExtraHTTPHeaders({'x-test-app':app,'x-test-user':user,'x-test-stage':'live'});await a.reload();await a.waitForFunction(()=>!!LukiSyncTest.getKey());
 // Revocation propagates to a second tab and leaves local/cloud data intact.
 const second=await mac.newPage();await second.goto(origin);await second.waitForFunction(()=>!!LukiSyncTest.getKey());
 const before=await a.evaluate(()=>LukiStorage.readControl().baseRevision);await a.evaluate(()=>document.getElementById('luki-lock').click());await a.waitForFunction(()=>!LukiSyncTest.getKey());await second.waitForFunction(()=>!LukiSyncTest.getKey());assert.equal(await a.evaluate(()=>fixtureRead().then(x=>x.note)),'SYNTHETIC WHILE MAC SUSPENDED');assert.equal(await a.evaluate(()=>LukiStorage.readControl().baseRevision),before);
 await a.evaluate(key=>{const S=LukiStorage;S.native.set.call(S.nativeSession,'luki-tab-key:'+S.cfg.app+':'+S.cfg.user,JSON.stringify({recovery:key,expires:Date.now()+900000}));},key);await a.reload();await a.waitForFunction(()=>!!window.LukiSyncTest);await a.evaluate(()=>LukiSyncTest.resumeAndSync());assert.equal(await a.evaluate(()=>LukiSyncTest.getKey()),null);
 // A legacy session on a fresh, never-unlinked synthetic profile is converted once.
 const legacyContext=await make(fs.mkdtempSync('/tmp/luki-device-legacy-'),{},'e'.repeat(64));contexts.push(legacyContext);const legacyPage=await pageOf(legacyContext);
 await legacyPage.evaluate(async key=>{const S=LukiStorage,fp=await LukiSyncTest.hash(Uint8Array.from({length:32},(_,i)=>i));S.update({keyFingerprint:fp});S.native.set.call(S.nativeSession,'luki-tab-key:'+S.cfg.app+':'+S.cfg.user,JSON.stringify({recovery:key,expires:Date.now()-1000}));},key);
 await legacyPage.reload();await legacyPage.waitForFunction(()=>!!LukiSyncTest.getKey());await legacyPage.waitForFunction(()=>LukiStorage.native.get.call(LukiStorage.nativeSession,'luki-tab-key:'+LukiStorage.cfg.app+':'+LukiStorage.cfg.user)===null);
 console.log('PASS',app,'CryptoKey persistente desktop/iPhone; oltre 15 minuti; riavvio browser; sospensione; Mac↔iPhone; rete; account isolati; scollegamento multi-scheda; migrazione sessione legacy');
 }finally{for(const c of contexts)await c.close().catch(()=>{});server.kill();}})().catch(e=>{console.error(e);server.kill();process.exitCode=1;});
