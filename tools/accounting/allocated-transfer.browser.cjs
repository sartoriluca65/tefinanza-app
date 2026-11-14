/* Archivio sintetico in un browser isolato; nessuna richiesta esterna. */
let browserTools;try{browserTools=require('playwright')}catch{browserTools=require('playwright-core')}
const {chromium}=browserTools,assert=require('node:assert/strict');
const origin=process.env.TEFINANZA_TEST_ORIGIN||'http://127.0.0.1:8775';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Only loopback allowed');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();page.on('dialog',dialog=>dialog.accept());
  await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  await page.goto(origin);await page.waitForFunction(()=>window.tefinanzaIsReady);
  await page.evaluate(async()=>{
   document.querySelectorAll('dialog[open]').forEach(d=>d.close());
   await change(s=>{s.accounts=['Fineco','Cassa Famiglia','Cassa Agricola'].map((name,i)=>({id:'account-'+i,name,bank:name,kind:i?'Altro':'Conto corrente',opening:i?0:1000}));s.movements=[];s.positions=[];s.documents=[]});
   transfer();
  });
  const rows=()=>page.locator('#splitRows [data-split-row]');
  async function quote(index,account,amount){await rows().nth(index).locator('[data-split=account]').selectOption(account);await rows().nth(index).locator('[data-split=amount]').fill(String(amount))}
  async function save(){await page.locator('#movementForm .dialog-actions .primary').click();await page.waitForFunction(()=>!document.querySelector('#modal').open)}
  async function open(id){await page.evaluate(id=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());editMovement(id)},id)}
  const snapshot=()=>page.evaluate(()=>structuredClone(state));
  await page.locator('[name=from]').selectOption('Fineco');await page.locator('[name=amount]').fill('100');
  await page.locator('#splitEnabled').check();await quote(0,'Cassa Famiglia',60);await page.locator('#addSplitRow').click();await quote(1,'Cassa Agricola',39);
  assert.equal(await rows().nth(0).locator('[data-split=category]').isVisible(),false);
  assert.equal(await page.locator('[name=to]').isVisible(),false);
  await page.locator('#movementForm .dialog-actions .primary').click();
  assert.match(await page.locator('#movementFormStatus').textContent(),/somma delle quote/);assert.equal((await snapshot()).movements.length,0);
  await quote(1,'Cassa Agricola',40);await save();let state=await snapshot();
  assert.deepEqual(state.movements.map(m=>m.amount),[-100,60,40]);
  const id=state.movements[0].id,child=state.movements[2].id;
  await open(child);assert.equal(await page.locator('[name=amount]').inputValue(),'100');assert.equal(await page.locator('#splitEnabled').isChecked(),true);
  await quote(0,'Cassa Famiglia',33.33);await quote(1,'Cassa Agricola',66.67);await save();
  state=await snapshot();assert.deepEqual(state.movements.map(m=>m.amount),[-100,33.33,66.67]);assert.equal(state.movements[0].id,id);
  await page.reload();await page.waitForFunction(()=>window.tefinanzaIsReady);await open(child);assert.equal(await rows().count(),2);
  // Un qualsiasi conto può essere la nuova origine, senza duplicare i movimenti.
  await page.locator('[name=from]').selectOption('Cassa Agricola');await quote(0,'Cassa Famiglia',25);await quote(1,'Fineco',75);await save();
  state=await snapshot();assert.equal(state.movements[0].account,'Cassa Agricola');assert.deepEqual(state.movements.map(m=>m.amount),[-100,25,75]);
  // Conversione a un giroconto semplice e di nuovo a più destinazioni.
  await open(id);await page.locator('#splitEnabled').uncheck();await page.locator('[name=to]').selectOption('Fineco');await save();assert.equal((await snapshot()).movements.length,2);
  await open(id);await page.locator('#splitEnabled').check();await quote(0,'Cassa Famiglia',60);await page.locator('#addSplitRow').click();await quote(1,'Fineco',40);await save();assert.equal((await snapshot()).movements.length,3);
  await open((await snapshot()).movements[2].id);await page.locator('#deleteMovement').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal((await snapshot()).movements.length,0);
  console.log('PASS browser: prelievo unico, quote 60/40, validazione totale, modifica dalla cassa, ricarica, cambio origine, conversione e cancellazione gruppo.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
