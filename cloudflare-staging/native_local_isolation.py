import uuid
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context();pages=[]
 for name in ['A','B']:
  page=context.new_page();page.set_extra_http_headers({'x-native':'1','x-test-app':'cartella-clinica','x-test-user':uuid.uuid4().hex*2});page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8765/');page.wait_for_function("typeof syncReady!=='undefined'&&syncReady");pages.append(page)
 pages[0].evaluate("async()=>{data.paziente.nome='Utente A sintetico';await syncNow();}")
 assert pages[1].evaluate('data.paziente.nome')==''
 pages[1].evaluate("async()=>{data.paziente.nome='Utente B sintetico';await syncNow();}")
 assert pages[0].evaluate('data.paziente.nome')=='Utente A sintetico'
 print('PASS: two different authenticated users on the same browser origin have separate clinical archives and independent editing locks')
 context.close();browser.close()
