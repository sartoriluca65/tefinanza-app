import uuid
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 for engine in ['chromium','firefox','webkit']:
  browser=getattr(p,engine).launch(headless=True,**({'executable_path':'/usr/bin/chromium','args':['--no-sandbox']} if engine=='chromium' else {}))
  context=browser.new_context(extra_http_headers={'x-native':'1','x-test-stage':'live','x-test-app':'tefinanza','x-test-user':uuid.uuid4().hex*2})
  page=context.new_page();page.route('https://**/*',lambda r:r.abort());page.goto('http://127.0.0.1:8766/');page.wait_for_function('window.tefinanzaIsReady')
  result=page.evaluate("""()=>{
   const before=JSON.stringify(state),r=TF.parseReceipt('MARKET\\n19/10/2026\\nCARTA IGIENICA 4,50\\n2 x 1,50\\nLATTE 3,00\\nTOTALE 7,50\\nCARTA CREDITO 7,50');
   if(r.items.length!==2||r.items[0].category!=='Casa'||r.items[1].qty!==2||r.items.reduce((n,x)=>n+x.total,0)!==7.5)throw Error('Receipt regression');
   for(const label of ['CARTA','CARTA DI CREDITO','CARTA DEBITO','CARTA VISA','CARTA ****1234']){
    const parsed=TF.parseReceipt('MARKET\\nCARTA FORNO 2,00\\nTOTALE 2,00\\n'+label+' 2,00');
    if(parsed.items.length!==1||parsed.items[0].name!=='CARTA FORNO')throw Error(label);
   }
   if(JSON.stringify(state)!==before)throw Error('Parser mutated archive');
   return {products:r.items.length,total:r.total,archiveUnchanged:true};
  }""")
  print(engine+': PASS '+str(result),flush=True);context.close();browser.close()
