import uuid
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for app in ['tefinanza','cartella-clinica','registro-credenziali']:
  c=b.new_context(extra_http_headers={'x-native':'1','x-test-stage':'live','x-test-app':app,'x-test-user':uuid.uuid4().hex*2})
  page=c.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8766/')
  page.wait_for_selector('#luki-cloud')
  assert page.locator('#luki-cloud strong').inner_text()=='ARCHIVIO PERSONALE · sincronizzazione cifrata'
  assert 'Non importare' not in page.locator('#luki-status').inner_text()
  page.evaluate("document.getElementById('luki-unlock').click()")
  assert 'soltanto dati sintetici' not in page.locator('#luki-dialog').inner_text()
  print('PASS live UI '+app,flush=True);c.close()
 b.close()
