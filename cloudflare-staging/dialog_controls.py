import uuid
from playwright.sync_api import sync_playwright,expect

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 user=uuid.uuid4().hex*2
 contexts=[browser.new_context(extra_http_headers={'x-native':'1','x-test-app':'cartella-clinica','x-test-user':user},viewport={'width':width,'height':900}) for width in [1280,390]]
 pages=[]
 for context in contexts:
  page=context.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8765/');page.wait_for_function("typeof syncReady!=='undefined'&&syncReady&&window.LukiSyncTest");pages.append(page)
 a,b=pages
 a.locator('#luki-unlock').click();dialog=a.locator('#luki-dialog')
 dialog.locator('input').fill('invalid-key')
 dialog.get_by_role('button',name='Sblocca con questa chiave',exact=True).click()
 expect(a.locator('#luki-dialog-status')).to_contain_text('chiave')
 expect(dialog.get_by_role('button',name='Sblocca con questa chiave',exact=True)).to_be_enabled()
 dialog.get_by_role('button',name='Crea chiave per il primo dispositivo',exact=True).click()
 expect(a.locator('#luki-dialog-status')).to_contain_text('conserva la chiave')
 code=dialog.locator('input').input_value()
 assert len(code)==43
 dialog.get_by_role('button',name='Sblocca con questa chiave',exact=True).click()
 expect(dialog).not_to_be_visible()
 expect(a.locator('#luki-status')).to_contain_text('Sincronizzato',timeout=15000)
 print('PASS: wrong-key errors and key-generation feedback stay visible inside the dialog; valid unlock works by clicking the real buttons')
 b.locator('#luki-history').click();history=b.locator('#luki-dialog')
 history.get_by_role('button',name='Verifica e usa sul dispositivo',exact=True).first.click()
 expect(b.locator('#luki-dialog-status')).to_contain_text('Sblocca prima')
 history.get_by_role('button',name='Sblocca per aprire le revisioni',exact=True).click()
 history.locator('input').fill(code)
 history.get_by_role('button',name='Sblocca con questa chiave',exact=True).click()
 expect(history).not_to_be_visible()
 b.locator('#luki-history').click();b.on('dialog',lambda d:d.accept())
 b.locator('#luki-dialog').get_by_role('button',name='Verifica e usa sul dispositivo',exact=True).first.click()
 b.wait_for_load_state();b.wait_for_function("typeof syncReady!=='undefined'&&syncReady&&window.LukiSyncTest")
 expect(b.locator('#luki-dialog')).not_to_be_visible()
 print('PASS: selecting a locked revision gives visible instructions; the inline unlock action and verified restore work at mobile width')
 for context in contexts:context.close()
 browser.close()
