import json
from playwright.sync_api import sync_playwright

BASE='http://127.0.0.1:8765'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 a=browser.new_context(extra_http_headers={'x-test-user':'a'*64})
 b=browser.new_context(extra_http_headers={'x-test-user':'a'*64})
 other=browser.new_context(extra_http_headers={'x-test-user':'b'*64})
 page=a.new_page();page.goto(BASE);page.wait_for_function('window.LukiSyncTest && window.fixtureDB')
 code=page.evaluate('LukiSyncTest.createRecovery()')
 page.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
 page.evaluate("fixturePut({accounts:[{id:'synthetic',balance:42}],movements:[{id:'test',amount:2}]},'%PDF-synthetic-original')")
 page.evaluate('LukiSyncTest.tick()')
 assert page.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")==1
 print('PASS: local IndexedDB and settings captured, encrypted and uploaded')
 second=b.new_page();second.goto(BASE);second.wait_for_function('window.LukiSyncTest && window.fixtureDB')
 second.evaluate('(code)=>LukiSyncTest.unlock(code)',code)
 # Explicit initial-device choice. Preserve its initial local archive too.
 second.evaluate("async()=>{const box=await fetch('/_sync/snapshot?revision=1',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json());const plain=await LukiSyncTest.open(await LukiSyncTest.importRecovery('"+code+"'),box,'luki-v1|tefinanza|'+ 'a'.repeat(64)+'|snapshot');window.copy=JSON.parse(new TextDecoder().decode(plain));window.copyHash=await LukiSyncTest.hash(plain);}")
 second.evaluate('LukiSyncTest.restore(copy,1,copyHash)');second.wait_for_load_state();second.wait_for_function('window.LukiSyncTest && window.fixtureDB')
 assert second.evaluate('fixtureRead()')['accounts'][0]['balance']==42
 assert second.evaluate("async()=>{const r=fixtureDB.transaction('files').objectStore('files').get('document');return new Promise(ok=>r.onsuccess=async()=>ok(await r.result.text()))}")=='%PDF-synthetic-original'
 print('PASS: second device restores all records and identical attachment bytes')
 second.evaluate('(code)=>LukiSyncTest.unlock(code)',code);second.evaluate('LukiSyncTest.tick()')
 assert second.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")==1,'Restored ciphertext must not cause synchronization loop'
 print('PASS: restored blobs reuse ciphertext and avoid revision ping-pong')
 page.evaluate("fixturePut({accounts:[{id:'synthetic',balance:50}]})");page.evaluate('LukiSyncTest.tick()')
 second.evaluate("fixturePut({accounts:[{id:'synthetic',balance:60}]})");second.evaluate('LukiSyncTest.tick()')
 history=second.evaluate("fetch('/_sync/history',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json())")
 assert len(history['revisions'])==2 and len(history['conflicts'])==1
 assert second.evaluate('fixtureRead()')['accounts'][0]['balance']==60
 print('PASS: simultaneous edits preserve remote history and local losing copy')
 outsider=other.new_page();outsider.goto(BASE);outsider.wait_for_function('window.LukiSyncTest && window.fixtureDB')
 assert outsider.evaluate('fixtureRead()') is None
 assert outsider.evaluate("fetch('/_sync/head',{headers:{'X-Luki-User':LUKI_CONFIG.user}}).then(r=>r.json()).then(r=>r.revision)")==0
 print('PASS: another user sees neither local nor remote records')
 # Same browser profile switches verified identity, using the same physical origin.
 switched=a.new_page();switched.set_extra_http_headers({'x-test-user':'b'*64});switched.goto(BASE);switched.wait_for_function('window.LukiSyncTest && window.fixtureDB')
 assert switched.evaluate('fixtureRead()') is None
 print('PASS: local user separation survives account switch on same browser')
 browser.close()
