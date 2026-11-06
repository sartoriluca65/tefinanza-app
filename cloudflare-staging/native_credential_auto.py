import uuid
TEST_USER=uuid.uuid4().hex*2
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 contexts=[browser.new_context(extra_http_headers={'x-native':'1','x-test-app':'registro-credenziali','x-test-user':TEST_USER}) for _ in range(2)]
 pages=[]
 for c in contexts:
  page=c.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8765/');page.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'");pages.append(page)
 a,b=pages;code=a.evaluate('LukiSyncTest.createRecovery()')
 for page in pages:page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
 a.evaluate("async()=>{const r=await demoVault.action('setup',{pin:'482951',confirmPin:'482951',secret:'risposta sintetica casuale lunga',confirmSecret:'risposta sintetica casuale lunga',question:'Domanda sintetica di prova?'});await finishPinLogin(r);}")
 a.evaluate('LukiSyncTest.tick()')
 b.evaluate("async(code)=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery(code),box,'luki-v1|'+LUKI_CONFIG.app+'|'+LUKI_CONFIG.user+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}",code)
 b.evaluate('LukiSyncTest.restore(copy,1,copyHash)');b.wait_for_load_state();b.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'")
 b.evaluate('(code)=>LukiSyncTest.unlock(code)',code);b.evaluate("async()=>{const r=await demoVault.action('unlock',{pin:'482951'});await finishPinLogin(r);document.activeElement?.blur();}")
 b.evaluate('LukiSyncTest.tick()')
 head=b.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")
 assert head==1,'PIN unlock alone must not create a data conflict'
 a.evaluate("demoVault.records('PUT',{service:'Auto sintetico',username:'synthetic@example.invalid',password:'AUTO-SYNTHETIC-456',notes:'prova'})");a.evaluate('LukiSyncTest.tick()')
 b.wait_for_timeout(3400);b.evaluate('LukiSyncTest.tick()');b.wait_for_load_state();b.wait_for_function("window.LukiSyncTest && typeof window.RicordaPinTransport==='function'")
 record=b.evaluate("async()=>{await demoVault.action('unlock',{pin:'482951'});return (await demoVault.records('GET')).find(r=>r.service==='Auto sintetico')}")
 assert record['password']=='AUTO-SYNTHETIC-456'
 print('PASS: Registro Credenziali automatically receives records; PIN unlock does not cause false conflicts')
 for c in contexts:c.close()
 browser.close()
