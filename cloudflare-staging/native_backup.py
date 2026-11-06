import uuid
TEST_USER=uuid.uuid4().hex*2
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for app in ['tefinanza','cartella-clinica','registro-credenziali']:
  context=browser.new_context(extra_http_headers={'x-native':'1','x-test-app':app,'x-test-user':TEST_USER})
  page=context.new_page();page.route('https://**/*',lambda route:route.abort());page.on('dialog',lambda d:d.accept());page.goto('http://127.0.0.1:8765/');page.wait_for_function('window.LukiSyncTest')
  if app=='tefinanza':
   page.wait_for_function('window.tefinanzaIsReady')
   result=page.evaluate("async()=>{const next=structuredClone(state);next.accounts[0].opening=42;await commit(next,[],{skipLocalArchive:true,skipDuplicateReview:true});const copy=await fullBackup();await commit({...structuredClone(state),budget:777},[],{skipLocalArchive:true,skipDuplicateReview:true});await restoreBackup(new File([JSON.stringify(copy)],'synthetic.json',{type:'application/json'}));const restored=state.budget===copy.budget&&state.accounts[0].opening===42;const safety=await dbGet('state','restoreSafety');return {restored,safety:safety.state.budget===777};}")
   assert result=={'restored':True,'safety':True}
   before=page.evaluate('JSON.stringify(state)');page.evaluate("restoreBackup(new File(['{bad json'],'broken.json'))");assert page.evaluate('JSON.stringify(state)')==before
   print('PASS: TeFinanza native JSON export/validation/confirmation/restore and prior safety copy; corrupt JSON leaves data unchanged')
  if app=='cartella-clinica':
   page.wait_for_function("typeof syncReady!=='undefined'&&syncReady&&window.TerapiaBackupJson")
   result=page.evaluate("async()=>{data.paziente.nome='Persona sintetica';const id=crypto.randomUUID();await demoFileStore('put',id,{key:id,blob:new Blob(['%PDF-native-backup-synthetic'],{type:'application/pdf'}),name:'synthetic.pdf'});data.documenti.push({id:'doc-synthetic',nome:'synthetic.pdf',fileKey:id,tipo:'application/pdf',ramo:'Documenti da classificare',path:'uploaded/'+id+'/synthetic.pdf'});await syncNow();const parts=[];const sink={writer:{async write(b){parts.push(b)},async close(){},async abort(){}},async cleanup(){}};await TerapiaBackupJson.pack(data,localFileResponse,sink);window.backupBlob=new File(parts,'synthetic.json',{type:'application/json'});data.paziente.nome='Prima del ripristino';await syncNow();await importBackup({target:{files:[backupBlob],value:''}});return {preview:document.getElementById('restoreSummary').textContent,prepared:!!preparedBackup};}")
   assert result['prepared'] and '1' in result['preview']
   page.evaluate('restorePreparedBackup()');assert page.evaluate('data.paziente.nome')=='Persona sintetica'
   assert page.evaluate("async()=>{const r=await recoveryRead();return r.data.paziente.nome}")=='Prima del ripristino'
   assert page.evaluate("async()=>{const f=(await demoFileStore('getAll'))[0];return f.blob.text()}")=='%PDF-native-backup-synthetic'
   result=page.evaluate("async()=>{const text=await backupBlob.text();let rejected=false;try{await TerapiaBackupJson.read(new File([text.replace('Persona sintetica','Dato alterato')],'broken.json'));}catch{rejected=true;}return rejected;}")
   assert result
   print('PASS: Cartella Clinica complete JSON with PDF, preview, restore, safety point and corrupted hash rejection')
  if app=='registro-credenziali':
   page.wait_for_function("typeof window.RicordaPinTransport==='function' && window.RicordaBackup")
   page.evaluate("async()=>{await demoVault.action('setup',{pin:'482951',confirmPin:'482951',secret:'risposta sintetica casuale lunga',confirmSecret:'risposta sintetica casuale lunga',question:'Domanda sintetica di prova?'});await finishPinLogin({recoveryConfigured:true,recoveryQuestion:'Domanda sintetica di prova?',expiresAt:Date.now()+900000});}")
   payload=json.dumps([{'service':'Servizio importato sintetico','username':'synthetic@example.invalid','password':'SYNTHETIC-NATIVE-JSON','notes':'Nota sintetica'}])
   page.evaluate("()=>{const d=document.getElementById('restoreBackup').closest('details');if(d)d.open=true;}");page.locator('#restoreBackup').click();page.locator('#backupFile').set_input_files({'name':'synthetic.json','mimeType':'application/json','buffer':payload.encode()});page.wait_for_function("!document.getElementById('backupConfirm').disabled")
   assert 'SYNTHETIC-NATIVE-JSON' not in page.locator('#backupPreview').inner_text()
   page.locator('#backupConfirm').click();page.wait_for_function("document.getElementById('backupStatus').textContent.includes('completato') || !document.getElementById('backupDialog').open")
   record=page.evaluate("async()=> (await demoVault.records('GET')).find(r=>r.service==='Servizio importato sintetico')")
   assert record['password']=='SYNTHETIC-NATIVE-JSON'
   test=page.evaluate("async()=>{const exported=JSON.stringify(await demoVault.records('GET'));const incoming=RicordaBackup.validate(exported);return RicordaBackup.plan(incoming,await demoVault.records('GET')).duplicates;}")
   assert test==7
   print('PASS: Registro Credenziali JSON import with hidden-password preview, encrypted local persistence, export and duplicate detection')
  context.close()
 browser.close()
