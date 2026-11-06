import uuid
TEST_USER=uuid.uuid4().hex*2
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for app in ['tefinanza','cartella-clinica']:
  contexts=[browser.new_context(extra_http_headers={'x-native':'1','x-test-app':app,'x-test-user':TEST_USER}) for _ in range(2)]
  pages=[]
  for c in contexts:
   page=c.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8765/');page.wait_for_function('window.LukiSyncTest');page.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady");page.wait_for_timeout(300);pages.append(page)
  a,b=pages;code=a.evaluate('LukiSyncTest.createRecovery()')
  for page in pages:page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
  if app=='tefinanza':a.evaluate('continueWithBrowserStorage()')
  a.evaluate('LukiSyncTest.tick()')
  b.evaluate("async(code)=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery(code),box,'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}",code)
  b.evaluate('LukiSyncTest.restore(copy,1,copyHash)');b.wait_for_load_state();b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  b.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
  b.evaluate("()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.activeElement?.blur();}")
  if app=='tefinanza':a.evaluate("async()=>{const n=structuredClone(state);n.accounts[0].opening=84;await commit(n,[],{skipLocalArchive:true,skipDuplicateReview:true})}")
  else:a.evaluate("async()=>{data.paziente.nome='Aggiornamento automatico sintetico';await syncNow();}")
  a.evaluate('LukiSyncTest.tick()');b.wait_for_timeout(3400);b.evaluate('LukiSyncTest.tick()');b.wait_for_load_state();b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  result=b.evaluate('state.accounts[0].opening' if app=='tefinanza' else 'data.paziente.nome')
  assert result==(84 if app=='tefinanza' else 'Aggiornamento automatico sintetico'),(app,result,b.locator('#luki-status').inner_text())
  if app=='tefinanza':a.evaluate("async()=>{const n=structuredClone(state);n.accounts[0].opening=126;await commit(n,[],{skipLocalArchive:true,skipDuplicateReview:true})}")
  else:a.evaluate("async()=>{data.paziente.nome='Secondo aggiornamento automatico';await syncNow();}")
  a.evaluate('LukiSyncTest.tick()');b.wait_for_timeout(3400);b.evaluate('LukiSyncTest.tick()');b.wait_for_load_state();b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  result=b.evaluate('state.accounts[0].opening' if app=='tefinanza' else 'data.paziente.nome')
  assert result==(126 if app=='tefinanza' else 'Secondo aggiornamento automatico'),(app,result,b.locator('#luki-status').inner_text())
  print('PASS: '+app+' automatically applies repeated remote changes without reentering the key during the unlocked tab session')
  for c in contexts:c.close()
 browser.close()
