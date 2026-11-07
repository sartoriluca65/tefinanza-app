import json,os,uuid,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

ROOT=Path(__file__).resolve().parent
legacy_source=(ROOT/'test-legacy-crypto.mjs').read_text()
fixed_source=(ROOT/'crypto.mjs').read_text()
def install_codec(page):
 page.evaluate('''({oldSource,newSource})=>{
  const load=source=>new Function(source.replace(/^export /gm,'')+';return {b64,un64,hash,importRecovery,seal,open,stable'+(source.includes('function recoveryBytes')?',recoveryBytes,normalizeRecovery':'')+'};')();
  window.legacy=load(oldSource);window.fixed=load(newSource);
 }''',{'oldSource':legacy_source,'newSource':fixed_source})
def open_app(context):
 page=context.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8766/');page.wait_for_function("window.LukiSyncTest&&typeof syncReady!=='undefined'&&syncReady");install_codec(page);return page

results=[]
with sync_playwright() as p:
 for engine in ['webkit','firefox','chromium']:
  browser=getattr(p,engine).launch(headless=True,**({'executable_path':os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),'args':['--no-sandbox']} if engine=='chromium' else {}))
  user=uuid.uuid4().hex*2
  contexts=[browser.new_context(extra_http_headers={'x-native':'1','x-test-app':'cartella-clinica','x-test-user':user}) for _ in range(3)]
  a,b,c=[open_app(context) for context in contexts]
  codec=a.evaluate('''async()=>{
   let oldError;try{legacy.un64('AAAAA')}catch(e){oldError={name:e.name,message:e.message};}
   const bytes=new Uint8Array(32).fill(255),keyText=legacy.b64(bytes),padded=keyText.replace(/-/g,'+').replace(/_/g,'/')+'=';
   const hash=await legacy.hash(legacy.un64(keyText));
   if(await fixed.hash(fixed.recoveryBytes(padded))!==hash)throw Error('Fingerprint changed');
   const keyOld=await legacy.importRecovery(keyText),keyNew=await fixed.importRecovery(padded);
   const message=new TextEncoder().encode('PDF sintetico e paziente di fantasia');const box=await legacy.seal(keyOld,message,'legacy-v1');
   if(new TextDecoder().decode(await fixed.open(keyNew,box,'legacy-v1'))!=='PDF sintetico e paziente di fantasia')throw Error('Legacy decryption failed');
   const oldAtob=window.atob;window.atob=value=>{if(value.length%4)throw new DOMException('The string contains invalid characters.','InvalidCharacterError');return oldAtob(value)};
   try{if(fixed.recoveryBytes(keyText).length!==32)throw Error('Padding normalization failed');}finally{window.atob=oldAtob;}
   for(const size of [0,1,2,3,32768,70001]){const raw=Uint8Array.from({length:size},(_,i)=>i%256);const decoded=fixed.un64(fixed.b64(raw));if(decoded.length!==raw.length||decoded.some((v,i)=>v!==raw[i]))throw Error('Binary mismatch');}
   return {oldError,validLegacyKeyBytes:legacy.un64(keyText).length,legacyCipherCompatible:true,strictPaddingCompatible:true,binaryCompatible:true};
  }''')
  print(engine,'codec:',json.dumps(codec,ensure_ascii=False),flush=True)
  a.locator('#luki-unlock').click();a.locator('#luki-dialog input').fill('AAAAA');a.get_by_role('button',name='Sblocca con questa chiave',exact=True).click();expect(a.locator('#luki-dialog-status')).to_contain_text('codifica Base64 non valida')
  assert a.evaluate('LukiStorage.readControl().keyFingerprint||null') is None
  a.get_by_role('button',name='Crea chiave per il primo dispositivo',exact=True).click();expect(a.locator('#luki-dialog input')).to_have_value(re.compile(r'^[A-Za-z0-9_-]{43}$'));code=a.locator('#luki-dialog input').input_value();assert len(code)==43
  a.get_by_role('button',name='Sblocca con questa chiave',exact=True).click();expect(a.locator('#luki-dialog')).not_to_be_visible();expect(a.locator('#luki-status')).to_contain_text('Sincronizzato',timeout=15000)
  # Replace nothing: append a separately encrypted legacy-format revision to synthetic history.
  before=a.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")
  legacy_revision=a.evaluate('''async({code,base})=>{
   const snapshot=await LukiSyncTest.capture(),box=await legacy.seal(await legacy.importRecovery(code),new TextEncoder().encode(fixed.stable(snapshot)),'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');
   const r=await fetch('/_sync/commit',{method:'POST',headers:{'Content-Type':'application/json','X-Luki-Request':'1','X-Luki-User':LUKI_CONFIG.user},body:JSON.stringify({baseRevision:base,operationId:crypto.randomUUID(),envelope:{format:'luki-e2ee-snapshot',version:1,...box,files:[]}})});return (await r.json()).revision;
  }''',{'code':code,'base':before})
  b.evaluate("()=>{const original=crypto.getRandomValues.bind(crypto);window.newRecoveryKeys=0;crypto.getRandomValues=bytes=>{if(bytes.length===32)newRecoveryKeys++;return original(bytes)};}")
  b.locator('#luki-unlock').click();b.get_by_role('button',name='Crea chiave per il primo dispositivo',exact=True).click();expect(b.locator('#luki-dialog-status')).to_contain_text('Esiste già una copia cloud');assert b.evaluate('newRecoveryKeys')==0
  formatted=code.replace('-','+').replace('_','/')+'='
  formatted=' \n'+formatted[:20]+'\n'+formatted[20:]+'\t'
  b.locator('#luki-dialog input').fill(formatted);b.get_by_role('button',name='Sblocca con questa chiave',exact=True).click();expect(b.locator('#luki-dialog')).not_to_be_visible();assert b.evaluate('newRecoveryKeys')==0
  b.locator('#luki-history').click();b.on('dialog',lambda d:d.accept())
  with b.expect_navigation(wait_until='load'):
   b.locator('#luki-dialog').get_by_role('button',name='Verifica e usa sul dispositivo',exact=True).first.click()
  b.wait_for_function("window.LukiSyncTest&&typeof syncReady!=='undefined'&&syncReady&&!LukiStorage.readControl().frozen")
  expect(b.locator('#luki-status')).to_contain_text('sbloccata in questa scheda')
  fingerprint=b.evaluate('LukiStorage.readControl().keyFingerprint')
  b.evaluate("async()=>{data.paziente.nome='Paziente sintetico '+LUKI_CONFIG.user.slice(0,4);await syncNow();}");b.evaluate('LukiSyncTest.tick()')
  head=b.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)");assert head>legacy_revision
  assert b.evaluate('LukiStorage.readControl().keyFingerprint')==fingerprint
  # An unreadable cached representation must not be erased during automatic session restoration.
  c.evaluate('''({fp})=>{LukiStorage.update({keyFingerprint:fp});const record={recovery:'AAAAA',expires:Date.now()+600000};const name='luki-tab-key:'+LUKI_CONFIG.app+':'+LUKI_CONFIG.user;LukiStorage.native.set.call(LukiStorage.nativeSession,name,JSON.stringify(record));}''',{'fp':fingerprint})
  c.reload();c.wait_for_function("window.LukiSyncTest&&typeof syncReady!=='undefined'&&syncReady");expect(c.locator('#luki-status')).to_contain_text('chiave salvata non è leggibile')
  saved=c.evaluate("JSON.parse(LukiStorage.native.get.call(LukiStorage.nativeSession,'luki-tab-key:'+LUKI_CONFIG.app+':'+LUKI_CONFIG.user))")
  assert saved['recovery']=='AAAAA' and c.evaluate('LukiStorage.readControl().keyFingerprint')==fingerprint
  print(engine,'PASS: create, invalid input, existing legacy cloud unlock, no regeneration, verified restore, sync, preserved cached key',flush=True)
  results.append({'engine':engine,'codec':codec,'flows':'passed'})
  for context in contexts:context.close()
  browser.close()
(ROOT/'crypto-browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
