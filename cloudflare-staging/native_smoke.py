from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for app in ['tefinanza','cartella-clinica','registro-credenziali']:
  context=browser.new_context(extra_http_headers={'x-native':'1','x-test-app':app,'x-test-user':'c'*64})
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('https://**/*',lambda route:route.abort())
  page.goto('http://127.0.0.1:8765/');page.wait_for_function('window.LukiSyncTest')
  if app=='tefinanza':page.wait_for_function('window.tefinanzaIsReady')
  if app=='cartella-clinica':page.wait_for_function("typeof syncReady!=='undefined' && syncReady")
  if app=='registro-credenziali':page.wait_for_function("typeof window.RicordaPinTransport==='function'")
  page.evaluate('async()=>{const code=LukiSyncTest.createRecovery();await LukiSyncTest.unlock(code);}')
  page.wait_for_timeout(500)
  snapshot=page.evaluate('LukiSyncTest.capture()')
  assert snapshot['app']==app and snapshot['format']=='luki-device-snapshot'
  assert not errors,(app,errors)
  print('PASS: original '+app+' starts with isolated storage and encrypted transport; '+str(len(snapshot['databases']))+' databases captured')
  context.close()
 browser.close()
