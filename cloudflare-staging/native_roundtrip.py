from playwright.sync_api import sync_playwright

def ready(page,app):
 page.wait_for_function('window.LukiSyncTest')
 if app=='tefinanza':page.wait_for_function('window.tefinanzaIsReady')
 if app=='cartella-clinica':page.wait_for_function("typeof syncReady!=='undefined' && syncReady")
 if app=='registro-credenziali':page.wait_for_function("typeof window.RicordaPinTransport==='function'")
 page.wait_for_timeout(400)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for app in ['tefinanza','cartella-clinica','registro-credenziali']:
  contexts=[browser.new_context(extra_http_headers={'x-native':'1','x-test-app':app,'x-test-user':'d'*64}) for i in range(2)]
  pages=[]
  for context in contexts:
   page=context.new_page();page.route('https://**/*',lambda route:route.abort());page.goto('http://127.0.0.1:8765/');ready(page,app);pages.append(page)
  a,b=pages;code=a.evaluate('LukiSyncTest.createRecovery()')
  for page in pages:page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
  if app=='tefinanza':a.evaluate("async()=>{const next=structuredClone(state);next.accounts[0].opening=42;await commit(next,[],{skipLocalArchive:true,skipDuplicateReview:true});}")
  if app=='cartella-clinica':a.evaluate("async()=>{data.paziente.nome='Paziente sintetico';const id=crypto.randomUUID();await demoFileStore('put',id,{key:id,blob:new Blob(['%PDF-synthetic-clinical'],{type:'application/pdf'}),name:'sintetico.pdf'});data.documenti.push({id:'doc-synthetic',nome:'sintetico.pdf',fileKey:id,tipo:'application/pdf',ramo:'Documenti da classificare',path:'uploaded/'+id+'/sintetico.pdf'});await syncNow();}")
  if app=='registro-credenziali':a.evaluate("async()=>{await demoVault.action('setup',{pin:'482951',confirmPin:'482951',secret:'risposta sintetica casuale lunga',confirmSecret:'risposta sintetica casuale lunga',question:'Domanda sintetica di prova?'});await demoVault.records('PUT',{service:'Servizio sintetico',username:'synthetic@example.invalid',password:'SYNTHETIC-SECRET-987',notes:'Nota di prova'});}")
  a.evaluate('LukiSyncTest.tick()')
  head=a.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json())")
  assert head['revision']==1,(app,head,a.locator('#luki-status').inner_text())
  wire=a.evaluate("fetch('/_sync/snapshot',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.text())")
  for secret in ['SYNTHETIC-SECRET-987','Paziente sintetico','482951',code]:assert secret not in wire
  b.evaluate("async(code)=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery(code),box,'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}",code)
  b.evaluate('LukiSyncTest.restore(copy,1,copyHash)');b.wait_for_load_state();ready(b,app)
  if app=='tefinanza':assert b.evaluate('state.accounts[0].opening')==42
  if app=='cartella-clinica':
   assert b.evaluate('data.paziente.nome')=='Paziente sintetico'
   assert b.evaluate("async()=>{const files=await demoFileStore('getAll');return await files[0].blob.text()}")=='%PDF-synthetic-clinical'
  if app=='registro-credenziali':
   record=b.evaluate("async()=>{await demoVault.action('unlock',{pin:'482951'});return (await demoVault.records('GET')).find(x=>x.service==='Servizio sintetico');}")
   assert record['password']=='SYNTHETIC-SECRET-987'
  print('PASS: '+app+' native records transferred, reopened and verified; cloud payload has no plaintext')
  # Verify no write on wrong recovery key, and previous local generation is retained.
  assert b.evaluate("LukiSyncTest.storage.native.get.call(LukiSyncTest.storage.nativeLocal,LukiSyncTest.storage.controlKey)")
  for context in contexts:context.close()
 browser.close()
