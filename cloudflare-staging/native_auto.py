import os
import uuid
TEST_USER=uuid.uuid4().hex*2
from playwright.sync_api import sync_playwright
def test_context(browser,**kwargs):
 if os.environ.get('TEST_ENGINE')=='webkit':
  return p.webkit.launch_persistent_context(__import__('tempfile').mkdtemp(prefix='luki-webkit-'),headless=True,**kwargs)
 return browser.new_context(**kwargs)

with sync_playwright() as p:
 browser=getattr(p,os.environ.get('TEST_ENGINE','chromium')).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if os.environ.get('TEST_ENGINE','chromium')=='chromium' else {}))
 for app in ['tefinanza','cartella-clinica']:
  contexts=[test_context(browser,extra_http_headers={'x-native':'1','x-test-stage':'live','x-test-app':app,'x-test-user':TEST_USER}) for _ in range(2)]
  pages=[]
  for c in contexts:
   page=c.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8766/');page.wait_for_function('window.LukiSyncTest');page.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady");page.wait_for_timeout(300);pages.append(page)
  a,b=pages;code=a.evaluate('LukiSyncTest.createRecovery()')
  for page in pages:page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
  if app=='tefinanza':a.evaluate('continueWithBrowserStorage()')
  a.evaluate('LukiSyncTest.tick()')
  b.evaluate("async(code)=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery(code),box,'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}",code)
  with b.expect_navigation(wait_until='load'):
   b.evaluate('LukiSyncTest.restore(copy,1,copyHash)')
  b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  b.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
  b.evaluate("()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.activeElement?.blur();}")
  if app=='tefinanza':a.evaluate("async()=>{const n=structuredClone(state);n.accounts[0].opening=84;await commit(n,[],{skipLocalArchive:true,skipDuplicateReview:true})}")
  else:a.evaluate("async()=>{data.paziente.nome='Aggiornamento automatico sintetico';await syncNow();}")
  a.evaluate('LukiSyncTest.tick()');b.wait_for_timeout(3400)
  with b.expect_navigation(wait_until='load'):
   b.evaluate('LukiSyncTest.tick()')
  b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  b.wait_for_function("document.getElementById('luki-status').textContent.includes('sbloccata in questa scheda')")
  result=b.evaluate('state.accounts[0].opening' if app=='tefinanza' else 'data.paziente.nome')
  assert result==(84 if app=='tefinanza' else 'Aggiornamento automatico sintetico'),(app,result,b.locator('#luki-status').inner_text())
  if app=='tefinanza':a.evaluate("async()=>{const n=structuredClone(state);n.accounts[0].opening=126;await commit(n,[],{skipLocalArchive:true,skipDuplicateReview:true})}")
  else:a.evaluate("async()=>{data.paziente.nome='Secondo aggiornamento automatico';await syncNow();}")
  a.evaluate('LukiSyncTest.tick()');b.wait_for_timeout(3400)
  with b.expect_navigation(wait_until='load'):
   b.evaluate('LukiSyncTest.tick()')
  b.wait_for_function('window.LukiSyncTest');b.wait_for_function('window.tefinanzaIsReady' if app=='tefinanza' else "typeof syncReady!=='undefined'&&syncReady")
  b.wait_for_function("document.getElementById('luki-status').textContent.includes('sbloccata in questa scheda')")
  result=b.evaluate('state.accounts[0].opening' if app=='tefinanza' else 'data.paziente.nome')
  assert result==(126 if app=='tefinanza' else 'Secondo aggiornamento automatico'),(app,result,b.locator('#luki-status').inner_text())
  print('PASS: '+app+' automatically applies repeated remote changes without reentering the key during the unlocked tab session')
  for c in contexts:c.close()
 browser.close()
