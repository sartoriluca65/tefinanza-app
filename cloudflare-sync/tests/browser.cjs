const {webkit,devices}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const cryptoSource=fs.readFileSync(path.join(root,'crypto.mjs'),'utf8').replace(/^export /gm,'');
const profiles=[['Safari desktop',{viewport:{width:1440,height:900}}],['iPhone Safari',devices['iPhone 13']]];
const apps=['cartella-clinica','tefinanza','registro-credenziali'];
const repoRoots=process.env.SYNC_REPOS_ROOT||'/workspace/three-sync/repos';
const folders={'cartella-clinica':path.join(repoRoots,'sartoriluca65.github.io/terapia-demo'),'tefinanza':path.join(repoRoots,'tefinanza-app'),'registro-credenziali':path.join(repoRoots,'registro-credenziali')};
if(!fs.existsSync(repoRoots)){for(const app of apps)delete folders[app];const config=JSON.parse(fs.readFileSync(path.join(root,'test-deployment.json'),'utf8'));folders[config.app]=path.resolve(root,config.source_directory);}
async function unlock(page,value){await page.locator('#luki-unlock').click();await page.getByLabel('Chiave di sincronizzazione di questa app',{exact:true}).fill(value);await page.getByRole('button',{name:'Sblocca con questa chiave',exact:true}).click();}
async function now(page){await page.evaluate(()=>document.activeElement.blur());await page.waitForTimeout(3100);await page.evaluate(()=>document.getElementById('luki-now').click());}
async function restore(page){page.once('dialog',d=>d.accept());await page.locator('#luki-history').click();await page.getByRole('button',{name:'Verifica e usa sul dispositivo',exact:true}).first().click();await page.waitForFunction(()=>!document.body.inert&&!document.getElementById('luki-dialog').open);}
(async()=>{
 const {api}=await import('../worker.mjs'),{makeEnv,USER}=await import('./support.mjs'),{bootstrap,controller}=await import('../assets.mjs');
 const browser=await webkit.launch({headless:true});
 try{for(const app of apps.filter(a=>!process.env.SYNC_TEST_APP||a===process.env.SYNC_TEST_APP)){
  const env=makeEnv(app);let origin;
  const server=http.createServer(async(req,res)=>{try{
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/_sync/')){let data;for await(const c of req)data=(data||'')+c;const headers={...req.headers};const response=await api(new Request(url,{method:req.method,headers,body:data}),env,USER);res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(Buffer.from(await response.arrayBuffer()));}
   if(url.pathname==='/_luki/bootstrap.js'||url.pathname==='/_luki/controller.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');return res.end(url.pathname.includes('bootstrap')?bootstrap:controller);}
   if(app==='tefinanza'&&url.pathname==='/sync.js'){res.setHeader('Content-Type','text/javascript');return res.end('// encrypted transport replaces legacy sync');}
   let html;
   if(url.pathname==='/'){html='<!doctype html><html><head><meta charset="utf-8"></head><body><script>var syncReady=true,uploadsPending=false,backupBusy=false,syncDirty=false,dirty=false,busy=false;window.tefinanzaIsReady=true;</script></body></html>';}
   else{const relative=url.pathname.replace(/^\/actual\//,'');const target=path.resolve(folders[app],relative||'index.html');if(!target.startsWith(folders[app]+path.sep)){res.statusCode=404;return res.end();}if(!fs.existsSync(target)){res.statusCode=404;return res.end();}const data=fs.readFileSync(target);if(!target.endsWith('.html')){const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm'}[path.extname(target)]||'application/octet-stream';res.setHeader('Content-Type',mime);return res.end(data);}html=data.toString();}
   html=html.replace(/<head([^>]*)>/i,`<head$1><script>window.LUKI_CONFIG=${JSON.stringify({app,user:USER.id,stage:true})};window.setInterval=()=>0;</script><script src="/_luki/bootstrap.js"></script>`);const end=html.toLowerCase().lastIndexOf('</body>');html=html.slice(0,end)+'<script src="/_luki/controller.js"></script>'+html.slice(end);res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);
  }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;env.ORIGIN=origin;
  try{
   for(const [profile,options] of profiles){const context=await browser.newContext(options),page=await context.newPage();await page.goto(origin);
    await page.addScriptTag({content:cryptoSource+';window.testCrypto={recoveryBytes,normalizeRecovery};'});
    const key=Buffer.alloc(32,224).toString('base64url');await page.evaluate(key=>{if(testCrypto.normalizeRecovery(key.slice(0,8)+'\u00a0\u200b\n'+key.slice(8))!==key)throw Error('Clipboard mismatch');},key);
    await unlock(page,key.slice(0,37));await page.waitForFunction(()=>document.getElementById('luki-dialog-status').textContent.includes('37'));assert.equal(env.objects.size,0);assert.equal(await page.evaluate(()=>LukiStorage.readControl().enabled),false);
    await page.getByLabel('Chiave di sincronizzazione di questa app',{exact:true}).fill(key.slice(0,10)+'!'+key.slice(11));await page.getByRole('button',{name:'Sblocca con questa chiave',exact:true}).click();await page.waitForFunction(()=>document.getElementById('luki-dialog-status').textContent.includes('non ammessi'));
    await page.getByRole('button',{name:'Mostra / nascondi chiave',exact:true}).click();assert.equal(await page.locator('#luki-dialog-status').innerText(),'');
    await context.close();console.log('PASS',app,profile,'chiavi incomplete e caratteri errati senza scritture');
   }
   const mac=await webkit.launchPersistentContext(fs.mkdtempSync('/tmp/luki-synthetic-mac-'),profiles[0][1]),phone=await webkit.launchPersistentContext(fs.mkdtempSync('/tmp/luki-synthetic-phone-'),profiles[1][1]),a=await mac.newPage(),b=await phone.newPage();await a.goto(origin);await b.goto(origin);
   await a.evaluate(async()=>{localStorage.setItem('synthetic-note','MAC');const db=await new Promise((ok,no)=>{const r=indexedDB.open('synthetic-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('items');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});await new Promise((ok,no)=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').put(new Blob(['synthetic original attachment'],{type:'text/plain'}),'attachment');tx.oncomplete=ok;tx.onerror=e=>no(new Error((tx.error||e.target.error)?.message||'IDB transaction error'));tx.onabort=()=>no(new Error(tx.error?.message||'IDB transaction aborted'));});db.close();});
   await a.locator('#luki-unlock').click();await a.getByRole('button',{name:'Crea chiave per il primo dispositivo',exact:true}).click();await a.waitForFunction(()=>document.querySelector('[aria-label="Chiave di sincronizzazione di questa app"]').readOnly);
   const key=await a.getByLabel('Chiave di sincronizzazione di questa app',{exact:true}).inputValue();assert.equal(key.length,43);assert.equal(env.objects.size,0);
   await a.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.copied=value},configurable:true}));await a.getByRole('button',{name:'Copia chiave',exact:true}).click();assert.equal(await a.evaluate(()=>window.copied),key);
   const downloadEvent=a.waitForEvent('download');await a.getByRole('button',{name:'Salva chiave in un file',exact:true}).click();const download=await downloadEvent;assert.equal(fs.readFileSync(await download.path(),'utf8').trim(),key);
   await a.getByLabel('Conferma chiave salvata').fill(key.slice(0,37));await a.getByRole('button',{name:'Sblocca con questa chiave',exact:true}).click();await a.waitForFunction(()=>document.getElementById('luki-dialog-status').textContent.includes('37'));assert.equal(env.objects.size,0);
   await a.getByLabel('Conferma chiave salvata').fill(key);await a.getByRole('button',{name:'Sblocca con questa chiave',exact:true}).click();await a.waitForFunction(()=>LukiStorage.readControl().baseRevision===1);assert(![...env.objects.values()].some(x=>Buffer.from(x).includes(Buffer.from('synthetic original attachment'))));
   await a.locator('#luki-unlock').click();await a.getByRole('button',{name:'Recupera chiave da questa scheda',exact:true}).click();assert.equal(await a.getByLabel('Chiave di sincronizzazione di questa app',{exact:true}).inputValue(),key);await a.getByRole('button',{name:'Crea chiave per il primo dispositivo',exact:true}).click();await a.waitForFunction(()=>document.getElementById('luki-dialog-status').textContent.includes('Esiste già'));await a.locator('#luki-dialog form button').click();
   await unlock(b,key.slice(0,7)+'\u00a0\u200b'+key.slice(7));await b.locator('#luki-dialog').waitFor({state:'hidden'});await restore(b);await b.waitForFunction(()=>localStorage.getItem('synthetic-note')==='MAC');
   assert.equal(await b.evaluate(async()=>{const db=await new Promise(ok=>{const r=indexedDB.open('synthetic-fixture');r.onsuccess=()=>ok(r.result);});const blob=await new Promise(ok=>{const r=db.transaction('items').objectStore('items').get('attachment');r.onsuccess=()=>ok(r.result);});db.close();return blob.text();}),'synthetic original attachment');
   await b.evaluate(()=>localStorage.setItem('synthetic-note','IPHONE'));await now(b);await b.waitForFunction(()=>LukiStorage.readControl().baseRevision===2);await now(a);await a.waitForFunction(()=>localStorage.getItem('synthetic-note')==='IPHONE');
   // Simultaneous local edits: second upload must become an immutable conflict, not overwrite head.
   await a.evaluate(()=>localStorage.setItem('synthetic-note','MAC CONCURRENT'));await b.evaluate(()=>localStorage.setItem('synthetic-note','PHONE CONCURRENT'));await now(a);await a.waitForFunction(()=>LukiStorage.readControl().baseRevision===3);await now(b);await b.waitForFunction(()=>!!LukiStorage.readControl().conflict);assert.equal(await b.evaluate(()=>localStorage.getItem('synthetic-note')),'PHONE CONCURRENT');assert.equal(env.sql.prepare('SELECT MAX(revision) AS n FROM revisions').get().n,3);assert(env.sql.prepare('SELECT COUNT(*) AS n FROM conflict_copies').get().n>=1);
   // App smoke checks with repository assets, no imports or personal data.
   if(folders[app])for(const [profile,options] of profiles){const c=await browser.newContext(options);await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const p=await c.newPage();await p.goto(origin+'/actual/index.html');await p.locator('#luki-cloud').waitFor({state:'attached'});assert.equal(await p.locator('#luki-unlock').count(),1);await p.screenshot({path:path.join(root,app+'-'+(profile.includes('iPhone')?'iphone':'desktop')+'.png'),fullPage:false});await c.close();}
   console.log('PASS',app,'prima chiave con conferma/file/copia, blob, Mac → iPhone → Mac, conflitti conservati, smoke app disponibili desktop/iPhone');await mac.close();await phone.close();
  }finally{await new Promise(r=>server.close(r));env.sql.close();}
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
