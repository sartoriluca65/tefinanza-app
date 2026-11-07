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
 contexts=[test_context(browser,extra_http_headers={'x-native':'1','x-test-stage':'live','x-test-app':'registro-credenziali','x-test-user':TEST_USER}) for _ in range(2)]
 pages=[]
 for c in contexts:
  page=c.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8766/');page.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'");pages.append(page)
 a,b=pages;code=a.evaluate('LukiSyncTest.createRecovery()')
 for page in pages:page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
 a.evaluate("async()=>{const r=await demoVault.action('setup',{pin:'482951',confirmPin:'482951',secret:'risposta sintetica casuale lunga',confirmSecret:'risposta sintetica casuale lunga',question:'Domanda sintetica di prova?'});await finishPinLogin(r);}")
 a.evaluate('LukiSyncTest.tick()')
 b.evaluate("async(code)=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery(code),box,'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}",code)
 with b.expect_navigation(wait_until='load'):
  b.evaluate('LukiSyncTest.restore(copy,1,copyHash)')
 b.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'")
 b.evaluate('(code)=>LukiSyncTest.unlock(code)',code);b.evaluate("async()=>{const r=await demoVault.action('unlock',{pin:'482951'});await finishPinLogin(r);document.activeElement?.blur();}")
 b.evaluate('LukiSyncTest.tick()')
 head=b.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")
 assert head==1,'PIN unlock alone must not create a data conflict'
 a.evaluate("demoVault.records('PUT',{service:'Auto sintetico',username:'synthetic@example.invalid',password:'AUTO-SYNTHETIC-456',notes:'prova'})");a.evaluate('LukiSyncTest.tick()')
 b.wait_for_timeout(3400)
 with b.expect_navigation(wait_until='load'):
  b.evaluate('LukiSyncTest.tick()')
 b.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'")
 record=b.evaluate("async()=>{await demoVault.action('unlock',{pin:'482951'});return (await demoVault.records('GET')).find(r=>r.service==='Auto sintetico')}")
 assert record['password']=='AUTO-SYNTHETIC-456'
 print('PASS: Registro Credenziali automatically receives records; PIN unlock does not cause false conflicts')
 for c in contexts:c.close()
 browser.close()
