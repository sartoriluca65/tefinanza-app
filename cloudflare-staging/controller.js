/* Encrypted, versioned staging transport. Never sends app plaintext or recovery keys. */
(()=>{'use strict';
// crypto.mjs e device-key.mjs sono concatenati dalla build.
CRYPTO_IMPLEMENTATION
DEVICE_KEY_IMPLEMENTATION
 const S=window.LukiStorage;if(!S)return;
 const {cfg,native,nativeLocal,nativeSession}=S,aad=`luki-v1|${cfg.app}|${cfg.user}`;
 let key=null,transportBusy=false,stopped=false,suspended=false,refreshNeeded=false,resumePromise=null,lastInteraction=Date.now();
 const tabKey='luki-tab-key:'+cfg.app+':'+cfg.user;
 const deviceRevisionKey='luki-device-key-revision:'+cfg.app+':'+cfg.user;
 const deviceRevision=()=>native.get.call(nativeLocal,deviceRevisionKey)||'0';
 function lockKey(){key=null;}
 async function rememberKey(candidate,fp,revision){return deviceKeys.save(candidate,fp,revision);}
 for(const type of ['input','change','keydown','pointerdown'])document.addEventListener(type,()=>{lastInteraction=Date.now();},true);
 function safeToApply(){if(Date.now()-lastInteraction<3000||document.querySelector('dialog[open], [contenteditable="true"]:focus')||document.activeElement?.matches('input,textarea,select'))return false;if(cfg.app==='tefinanza')return !!window.tefinanzaIsReady&&(typeof docDraft==='undefined'||!docDraft);if(cfg.app==='cartella-clinica')return typeof syncReady!=='undefined'&&syncReady&&!uploadsPending&&!backupBusy&&!syncDirty;if(cfg.app==='registro-credenziali')return typeof dirty!=='undefined'&&!dirty&&!busy;return false;}
 const transport=native.open(`luki-transport:${cfg.app}:${cfg.user}`,1);
 const transportReady=new Promise((resolve,reject)=>{transport.onupgradeneeded=()=>transport.result.createObjectStore('items');transport.onsuccess=()=>resolve(transport.result);transport.onerror=()=>reject(transport.error);});
 async function item(name,value){const db=await transportReady;return new Promise((resolve,reject)=>{const tx=native.transaction.call(db,'items',arguments.length>1?'readwrite':'readonly');const req=arguments.length>1?tx.objectStore('items').put(value,name):tx.objectStore('items').get(name);tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Trasporto non salvato'));});}
 async function removeItem(name){const db=await transportReady;return new Promise((resolve,reject)=>{const tx=native.transaction.call(db,'items','readwrite');tx.objectStore('items').delete(name);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
 const deviceKeys=createDeviceKeyStore({app:cfg.app,user:cfg.user,aad,read:name=>item(name),write:(name,value)=>item(name,value),remove:removeItem,getFingerprint:()=>S.readControl().keyFingerprint,getRevision:deviceRevision,advanceRevision:()=>native.set.call(nativeLocal,deviceRevisionKey,crypto.randomUUID()),withLock:fn=>navigator.locks?navigator.locks.request('luki-device-key',fn):fn()});
 async function request(path,body,method=body===undefined?'GET':'POST'){
  const r=await fetch('/_sync/'+path,{method,credentials:'same-origin',redirect:'error',headers:body===undefined?{'X-Luki-User':cfg.user}:{'Content-Type':'application/json','X-Luki-Request':'1','X-Luki-User':cfg.user},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const result=await r.json().catch(()=>({error:'Risposta non valida'}));if(!r.ok&&r.status!==409)throw Object.assign(Error(result.error||'Servizio non disponibile'),{status:r.status});return {...result,status:r.status};
 }
 function say(text){status.textContent=text;if(dialog.open)dialogStatus.textContent=text;updateCompactStatus(text);}
 function updateCompactStatus(text){const brief=document.getElementById('luki-sync-brief');if(!brief)return;const value=String(text||'');let label='Da attivare',state='idle';if(/^Sincronizzato/.test(value)){label='Sincronizzato';state='ok';}else if(/sospesa|Conflitto|non completat|non disponibile|non corrisponde|non apre|non valida|mancante|non è leggibile/i.test(value)){label='Da controllare';state='attention';}else if(/sbloccata/i.test(value)){label='Pronta';state='ok';}else if(/scollegat/i.test(value)){label='Scollegato';}else if(/bloccat/i.test(value)){label='Bloccata';}else if(/Carico|verifico|Ripristino|in corso/i.test(value)){label='In corso';state='busy';}brief.textContent=label;const summary=document.getElementById('luki-sync-summary');summary.dataset.state=state;summary.setAttribute('aria-label','Apri menu archivio. Sincronizzazione: '+value);summary.title=value;}
 function compactArchiveMenu(){
  panel.classList.add('luki-compact-cloud');panel.style.cssText='position:relative;z-index:110;display:flex;justify-content:flex-end;padding:5px 12px;box-sizing:border-box;font:13px/1.4 system-ui;';
  const settings=document.createElement('details');settings.id='luki-sync-settings';const summary=document.createElement('summary');summary.id='luki-sync-summary';summary.innerHTML='<span aria-hidden="true" class="luki-sync-dot"></span><span>Archivio</span><span aria-hidden="true">·</span><span id="luki-sync-brief">Da attivare</span>';settings.append(summary);
  const controls=document.createElement('div');controls.className='luki-sync-controls';const modal=panel.querySelector('#luki-dialog');modal.remove();while(panel.firstChild)controls.append(panel.firstChild);const title=controls.querySelector('strong');if(title&&live)title.textContent='Archivio personale';settings.append(controls);panel.append(settings,modal);
  const style=document.createElement('style');style.textContent=`
#luki-cloud.luki-compact-cloud{color:#18343b;vertical-align:middle}
#luki-sync-settings>summary{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:3px 10px;box-sizing:border-box;list-style:none;cursor:pointer;border:1px solid #c6dbd8;border-radius:999px;background:#fff;color:#245752;font-size:12px;white-space:nowrap}
#luki-sync-settings>summary::-webkit-details-marker{display:none}
#luki-sync-summary .luki-sync-dot{width:7px;height:7px;border-radius:50%;background:#7a8f91}
#luki-sync-summary[data-state=ok] .luki-sync-dot{background:#168876}
#luki-sync-summary[data-state=attention]{border-color:#c18525;background:#fff8e8;color:#805713}
#luki-sync-summary[data-state=attention] .luki-sync-dot{background:#ba7c17}
#luki-sync-settings[open]>.luki-sync-controls{position:absolute;right:0;top:calc(100% + 6px);z-index:10000;width:min(440px,calc(100vw - 28px));max-height:65dvh;overflow:auto;box-sizing:border-box;padding:16px;border:1px solid #bed3d0;border-radius:12px;background:white;color:#18343b;box-shadow:0 10px 35px #173f3b25;font:14px/1.5 system-ui;text-align:left}
#luki-cloud .luki-sync-controls>strong{display:block;font-size:15px;margin-bottom:6px}
#luki-cloud .luki-sync-controls button,#luki-cloud .luki-sync-controls a{font:inherit;font-size:13px;padding:9px 11px;margin:4px 4px 4px 0;border:1px solid #c7d7d5;border-radius:8px;background:#f7faf9;color:#245752;cursor:pointer;display:inline-block;text-decoration:none}
#luki-cloud .luki-sync-controls button[hidden]{display:none}
#luki-cloud #luki-dialog{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(680px,calc(100vw - 24px))!important;max-height:85dvh;overflow:auto;border:1px solid #bed3d0;border-radius:16px;background:#fff;color:#18343b;padding:20px!important;font:15px/1.5 system-ui;box-shadow:0 20px 70px #123f4933}
#luki-cloud #luki-dialog::backdrop{background:#123f4966}
#luki-cloud #luki-dialog input{box-sizing:border-box;max-width:100%;font-size:16px;border:1px solid #bdd1cf;border-radius:8px;padding:10px;min-height:44px}
#luki-cloud #luki-dialog button{font:inherit;padding:10px 12px;border:1px solid #bdd1cf;border-radius:8px;margin:5px 5px 5px 0;background:#f3f8f7;color:#245752;cursor:pointer}
#luki-cloud #luki-dialog pre{font-size:12px}
#luki-cloud summary:focus-visible,#luki-cloud button:focus-visible{outline:3px solid #168876;outline-offset:3px}
@media(max-width:700px){#luki-sync-settings>summary{font-size:11px;min-height:40px;padding:3px 9px}#luki-sync-settings[open]>.luki-sync-controls{position:fixed;top:auto;bottom:12px;right:12px;max-height:65dvh}}
@media print{#luki-cloud{display:none!important}}

#luki-cloud .luki-archive-info{display:grid;gap:8px;margin:12px 0;padding:12px 0;border-top:1px solid #c7d7d5}
#luki-cloud .luki-archive-info small{color:#405c65}
#luki-cloud .luki-sync-controls button:not(:disabled):hover,#luki-cloud .luki-sync-controls a:hover{background:#e5f1ef;color:#18343b}
#luki-cloud .luki-sync-controls button{min-height:44px}
`;panel.append(style);
  // Move the existing nodes so storage and backup status keep their live updates.
  const archiveHeader=document.querySelector('main>header');
  if(archiveHeader){archiveHeader.classList.add('luki-archive-info');controls.append(archiveHeader);}
  const backupTrigger=document.querySelector('[data-page="backup"],[data-goto="backup"]');
  if(backupTrigger){const backup=document.createElement('button');backup.type='button';backup.textContent='Backup e controlli';backup.addEventListener('click',()=>{settings.open=false;backupTrigger.click();});controls.insertBefore(backup,controls.querySelector('#luki-unlock'));}
  controls.addEventListener('click',event=>{if(event.target.closest('button,a'))settings.open=false;});
  updateCompactStatus(panel.querySelector('#luki-status').textContent);

  document.addEventListener('click',event=>{if(!panel.contains(event.target))settings.open=false;});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.open)settings.open=false;});
 }

 async function localBlob(blob){
  const chunks=[];
  for(let offset=0;offset<blob.size;offset+=1024*1024){const bytes=new Uint8Array(await blob.slice(offset,offset+1024*1024).arrayBuffer()),plainHash=await hash(bytes),cacheName='blob:'+S.readControl().keyFingerprint+':'+plainHash;let record=await item(cacheName);
   if(!record){const box=await seal(key,bytes,aad+'|blob|'+plainHash),wire=enc.encode(JSON.stringify(box));record={plainHash,hash:await hash(wire),wire};await item(cacheName,record);}
   chunks.push({plainHash,hash:record.hash});
  }
  return {t:'blob',size:blob.size,mime:blob.type,name:blob instanceof File?blob.name:null,lastModified:blob instanceof File?blob.lastModified:null,chunks};
 }
 async function encode(value,depth=0){if(depth>100)throw Error('Archivio troppo annidato');if(value===undefined)return {t:'undefined'};if(typeof value==='number'&&!Number.isFinite(value))return {t:'number',v:String(value)};if(value===null||['string','number','boolean'].includes(typeof value))return value;
  if(value instanceof Blob)return localBlob(value);
  if(value instanceof Date)return {t:'date',v:value.toISOString()};
  if(value instanceof ArrayBuffer)return {t:'bytes',v:b64(new Uint8Array(value))};
  if(ArrayBuffer.isView(value))return {t:'typed',type:value.constructor.name,v:b64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
  if(typeof FileSystemHandle!=='undefined'&&value instanceof FileSystemHandle)return {t:'local-handle'};
  if(Array.isArray(value))return {t:'array',v:await Promise.all(value.map(x=>encode(x,depth+1)))};
  if(value instanceof Map)return {t:'map',v:await Promise.all([...value].map(async([k,v])=>[await encode(k,depth+1),await encode(v,depth+1)]))};
  if(value instanceof Set)return {t:'set',v:await Promise.all([...value].map(x=>encode(x,depth+1)))};
  if(value&&Object.getPrototypeOf(value)===Object.prototype||value&&Object.getPrototypeOf(value)===null)return {t:'object',v:await Promise.all(Object.keys(value).sort().map(async k=>[k,await encode(value[k],depth+1)]))};
  throw Error('Dato non trasferibile: nessuna copia è stata sostituita');
 }
 function chunkRefs(value,result=new Set()){if(!value||typeof value!=='object')return result;if(value.t==='blob'){for(const c of value.chunks)result.add(c.hash);}else for(const child of Object.values(value)){if(Array.isArray(child))for(const v of child)chunkRefs(v,result);else chunkRefs(child,result);}return result;}
 async function openLocal(name,version){return new Promise((resolve,reject)=>{const r=version===undefined?native.open(name):native.open(name,version);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Chiudi le altre schede e riprova'));});}
 async function readDatabase(name){const db=await openLocal(S.prefix+name);try{const stores=[...db.objectStoreNames];const raw=await new Promise((resolve,reject)=>{if(!stores.length){resolve([]);return;}const tx=native.transaction.call(db,stores,'readonly'),out=[];for(const name of stores){const store=tx.objectStore(name),record={name,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes:[...store.indexNames].map(n=>{const i=store.index(n);return {name:n,keyPath:i.keyPath,unique:i.unique,multiEntry:i.multiEntry};}),rows:[]};out.push(record);const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){record.rows.push({key:c.key,value:c.value});c.continue();}};}tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
   return {name,version:db.version,stores:await Promise.all(raw.map(async st=>({...st,rows:await Promise.all(st.rows.map(async row=>({key:await encode(row.key),value:await encode(cfg.app==='cartella-clinica'&&st.name==='cache'&&row.key==='state'&&row.value?.data?{...row.value,version:0,base:null,dirty:false}:row.value)})))})))};
  }finally{db.close();}}
 function portableSetting(name,value){if(cfg.app==='registro-credenziali'&&name==='luca-sartori-ricorda-demo-protected-v2'){const v=JSON.parse(value);if(v?.version===2&&v.pin&&v.recovery&&v.payload)return stable({...v,revision:'transport-version',pin:{...v.pin,failures:0,lockedUntil:0},recovery:{...v.recovery,failures:0,lockedUntil:0}});}return value;}
 async function capture(){const before=S.readControl();if(before.frozen)throw Error('Ripristino in corso');const storage=S.keys().map(k=>[k,portableSetting(k,native.get.call(nativeLocal,S.prefix+k))]);const databases=[];for(const name of before.databases)databases.push(await readDatabase(name));const after=S.readControl();if(before.stamp!==after.stamp||before.generation!==after.generation)throw Error('Archivio modificato durante la lettura: riprovo al prossimo controllo');return {format:'luki-device-snapshot',version:1,app:cfg.app,storage,databases};}
 async function downloadChunk(ref){const r=await fetch('/_sync/blob/'+ref.hash,{cache:'no-store',credentials:'same-origin',redirect:'error',headers:{'X-Luki-User':cfg.user}});if(!r.ok)throw Error('Allegato non disponibile: nessuna copia sostituita');const bytes=new Uint8Array(await r.arrayBuffer());if(await hash(bytes)!==ref.hash)throw Error('Allegato cloud danneggiato');const plain=await open(key,JSON.parse(new TextDecoder().decode(bytes)),aad+'|blob|'+ref.plainHash);if(await hash(plain)!==ref.plainHash)throw Error('Originale non valido');await item('blob:'+S.readControl().keyFingerprint+':'+ref.plainHash,{plainHash:ref.plainHash,hash:ref.hash,wire:bytes});return plain;}
 async function decode(value,depth=0){if(depth>100)throw Error('Archivio troppo annidato');if(!value||typeof value!=='object')return value;
  switch(value.t){case 'undefined':case 'local-handle':return undefined;case 'number':return Number(value.v);case 'date':return new Date(value.v);case 'bytes':return un64(value.v).buffer;case 'typed':{const types={Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray,DataView};const Type=types[value.type];if(!Type)throw Error('Tipo binario non supportato');return new Type(un64(value.v).buffer);}
   case 'blob':{const parts=[];for(const ref of value.chunks)parts.push(await downloadChunk(ref));const blob=value.name?new File(parts,value.name,{type:value.mime,lastModified:value.lastModified}):new Blob(parts,{type:value.mime});if(blob.size!==value.size)throw Error('Allegato incompleto');return blob;}
   case 'array':return Promise.all(value.v.map(v=>decode(v,depth+1)));case 'object':return Object.fromEntries(await Promise.all(value.v.map(async([k,v])=>[k,await decode(v,depth+1)])));case 'map':return new Map(await Promise.all(value.v.map(async([k,v])=>[await decode(k,depth+1),await decode(v,depth+1)])));case 'set':return new Set(await Promise.all(value.v.map(v=>decode(v,depth+1))));default:throw Error('Formato non valido');}
 }
 async function savePending(snapshot){const text=stable(snapshot),plainHash=await hash(enc.encode(text)),box=await seal(key,enc.encode(text),aad+'|snapshot');const pending={operationId:crypto.randomUUID(),baseRevision:S.readControl().baseRevision,plainHash,envelope:{format:'luki-e2ee-snapshot',version:1,...box,files:[...chunkRefs(snapshot)].sort()}};if(enc.encode(JSON.stringify(pending)).length>8*1024*1024)throw Error('Metadati oltre 8 MB: la copia locale resta intatta');await item('pending',pending);return pending;}
 async function uploadPending(pending){
  // Ciphertext chunks are persisted locally before network use, so failed uploads can retry.
  const db=await transportReady;const records=await new Promise((resolve,reject)=>{const tx=native.transaction.call(db,'items','readonly'),r=tx.objectStore('items').getAll();tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);});const available=new Map(records.filter(x=>x?.hash&&x?.wire).map(x=>[x.hash,x]));
  for(const h of pending.envelope.files){const exists=await fetch('/_sync/blob/'+h,{method:'HEAD',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'X-Luki-User':cfg.user}});if(exists.ok)continue;if(exists.status!==404)throw Error('Verifica allegati non disponibile');const record=available.get(h);if(!record)throw Error('Frammento locale non disponibile: copia precedente conservata');const r=await fetch('/_sync/blob/'+h,{method:'PUT',credentials:'same-origin',redirect:'error',headers:{'Content-Type':'application/octet-stream','X-Luki-Request':'1','X-Luki-User':cfg.user},body:record.wire});if(!r.ok)throw Error('Caricamento allegato interrotto');}
  const result=await request('commit',{operationId:pending.operationId,baseRevision:pending.baseRevision,envelope:pending.envelope});
  if(result.status===409){await item('conflict:'+pending.operationId,pending);await removeItem('pending');S.update({conflict:pending.operationId});say('Conflitto: entrambe le copie sono conservate. Apri “Copie e ripristino”.');return false;}
  S.update({baseRevision:result.revision,baseHash:pending.plainHash,conflict:null});await removeItem('pending');say('Sincronizzato · revisione '+result.revision);return true;
 }
 async function readRemote(revision){const box=await request('snapshot'+(typeof revision==='string'?'?conflict='+encodeURIComponent(revision):revision?'?revision='+revision:''));if(box.format!=='luki-e2ee-snapshot')throw Error('Copia cifrata non valida');const bytes=await open(key,box,aad+'|snapshot');const snapshot=JSON.parse(new TextDecoder().decode(bytes));if(snapshot.format!=='luki-device-snapshot'||snapshot.version!==1||snapshot.app!==cfg.app||!Array.isArray(snapshot.storage)||!Array.isArray(snapshot.databases))throw Error('Copia non compatibile');const expected=[...chunkRefs(snapshot)].sort();if(stable(expected)!==stable(box.files))throw Error('Indice allegati incoerente');return {snapshot,plainHash:await hash(bytes)};}
 async function restore(snapshot,revision,plainHash,requireReview=false){
  // Stage a whole new generation; commit is a single pointer switch. Old generation is retained.
  const current=S.readControl(),newGeneration=crypto.randomUUID(),prefix=`luki:${cfg.app}:${cfg.user}:${newGeneration}:`;S.update({frozen:true});document.body.inert=true;
  try{
   await new Promise(resolve=>setTimeout(resolve,600));const stamp=S.readControl().stamp;if(stamp!==current.stamp)throw Error('Un salvataggio locale era ancora in corso: ripeti il ripristino');
   const decoded=[];for(const db of snapshot.databases){if(typeof db.name!=='string'||db.name.length>256||!Number.isInteger(db.version)||db.version<1||!Array.isArray(db.stores))throw Error('Database non valido');const stores=[];for(const store of db.stores){stores.push({...store,rows:await Promise.all(store.rows.map(async row=>({key:await decode(row.key),value:await decode(row.value)})))});}decoded.push({...db,stores});}
   for(const db of decoded){const target=await new Promise((resolve,reject)=>{const r=native.open(prefix+db.name,db.version);r.onupgradeneeded=()=>{for(const store of db.stores){const s=r.result.createObjectStore(store.name,{keyPath:store.keyPath,autoIncrement:store.autoIncrement});for(const i of store.indexes)s.createIndex(i.name,i.keyPath,{unique:i.unique,multiEntry:i.multiEntry});}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Archivio di destinazione occupato'));});try{if(db.stores.length)await new Promise((resolve,reject)=>{const tx=native.transaction.call(target,db.stores.map(s=>s.name),'readwrite');for(const store of db.stores){const s=tx.objectStore(store.name);for(const row of store.rows){if(store.keyPath===null)s.add(row.value,row.key);else s.add(row.value);}}tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{target.close();}}
   for(const [name,value]of snapshot.storage){if(typeof name!=='string'||typeof value!=='string')throw Error('Impostazione non valida');native.set.call(nativeLocal,prefix+name,value);}
   if(S.readControl().stamp!==stamp)throw Error('Dati cambiati durante il ripristino: nessuna attivazione');
   // Keep the previous control record for recovery; no old stores or files are deleted.
   await item('generation:'+current.generation,{...current,savedAt:Date.now()});const pending=await item('pending');if(pending){await item('pending-before-restore:'+crypto.randomUUID(),pending);await removeItem('pending');}
   native.set.call(nativeLocal,S.controlKey,JSON.stringify({...current,generation:newGeneration,databases:snapshot.databases.map(d=>d.name),baseRevision:revision,baseHash:plainHash,stamp:crypto.randomUUID(),conflict:requireReview?"restored-copy":null,frozen:false,pendingApply:null}));
   location.reload();
  }catch(error){S.update({frozen:false});document.body.inert=false;throw error;}
 }
 async function tick(){if(!key||transportBusy||stopped||suspended||refreshNeeded||S.readControl().frozen)return;transportBusy=true;
  try{await navigator.locks.request('luki-sync',{ifAvailable:true},async lock=>{if(!lock)return;const ctl=S.readControl();if(ctl.generation!==S.generation){refreshNeeded=true;say('Archivio cambiato: riapri la pagina');return;}if(ctl.conflict){say('Conflitto conservato. Apri “Copie e ripristino”.');return;}const pending=await item('pending');if(pending){if(!await uploadPending(pending))return;}
   const snapshot=await capture(),plainHash=await hash(enc.encode(stable(snapshot))),now=S.readControl(),remote=await request('head');
   if(now.baseHash===plainHash){if(remote.revision!==now.baseRevision){if(!safeToApply()){say('Aggiornamento online disponibile: attendo il termine delle modifiche sul dispositivo.');return;}say('Aggiornamento da un altro dispositivo: verifico gli originali…');const copy=await readRemote(remote.revision);if(!safeToApply()||S.readControl().stamp!==now.stamp)throw Error('Nuove modifiche locali: confronto rinviato senza sostituire dati');await restore(copy.snapshot,remote.revision,copy.plainHash);}else say('Sincronizzato · revisione '+remote.revision);return;}
   if(remote.revision!==now.baseRevision){await uploadPending(await savePending(snapshot));return;}
   await uploadPending(await savePending(snapshot));
  });}catch(error){say('Sincronizzazione sospesa: '+(error.message||'errore')+'. I dati locali restano salvati.');}finally{transportBusy=false;}
 }
 const panel=document.createElement('section');panel.id='luki-cloud';panel.style.cssText='position:relative;z-index:10000;padding:12px 16px;background:#eaf2ff;color:#122843;border-bottom:2px solid #4172a4;font:14px/1.5 system-ui';
 const live=cfg.stage===false;
 panel.innerHTML='<strong>PROVA PRIVATA · solo dati di fantasia</strong><div id="luki-status" role="status">Sincronizzazione cifrata da configurare. Non importare ancora backup personali.</div><button id="luki-unlock">Sblocca sincronizzazione</button> <button id="luki-lock">Scollega questo dispositivo</button> <button id="luki-history">Copie e ripristino</button> <button id="luki-now">Sincronizza ora</button> <a href="/cdn-cgi/access/logout">Esci dall’account</a><dialog id="luki-dialog" style="max-width:680px;width:90%;padding:20px"><div id="luki-dialog-content"></div><form method="dialog"><button>Chiudi</button></form></dialog>';
 if(live){panel.querySelector('strong').textContent='ARCHIVIO PERSONALE · sincronizzazione cifrata';panel.querySelector('#luki-status').textContent='Sblocca la sincronizzazione con la chiave di questa app.';}
 compactArchiveMenu();document.body.prepend(panel);const status=document.getElementById('luki-status'),dialog=document.getElementById('luki-dialog'),content=document.getElementById('luki-dialog-content');
 const dialogStatus=document.createElement('p');dialogStatus.id='luki-dialog-status';dialogStatus.setAttribute('role','status');dialogStatus.setAttribute('aria-live','polite');dialogStatus.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;padding:10px 0;font-weight:600';dialog.insertBefore(dialogStatus,dialog.querySelector('form'));
 function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');b.textContent='Attendi…';if(dialog.open)dialogStatus.textContent='Operazione in corso…';try{await action();}catch(e){say(e.message||'Operazione non completata. Riprova.');}finally{if(b.isConnected){b.disabled=false;b.removeAttribute('aria-busy');b.textContent=text;}}};return b;}
 function show(){content.replaceChildren();dialogStatus.textContent='';if(!dialog.open)dialog.showModal();}
 document.getElementById('luki-unlock').onclick=async()=>{show();const p=document.createElement('p');p.textContent='La chiave di sincronizzazione protegge la copia cloud. Conservala fuori da questa app: email e passkey non possono recuperarla. Inserisci la stessa chiave una volta per browser: verrà ricordata per questo account. Per rimuovere l’associazione usa “Scollega questo dispositivo”. '+(live?'Conserva una copia della chiave fuori dall’app.':'In questa fase usa soltanto dati sintetici.');const input=document.createElement('input');input.type='password';input.autocomplete='off';input.autocapitalize='none';input.spellcheck=false;input.setAttribute('autocorrect','off');input.setAttribute('aria-label','Chiave di sincronizzazione di questa app');input.placeholder='Chiave di sincronizzazione';input.style.width='95%';content.append(p,input);
  content.append(button('Sblocca con questa chiave',async()=>{const revision=deviceRevision(),candidate=await importRecovery(input.value),fp=await hash(recoveryBytes(input.value)),ctl=S.readControl(),remote=await request('head');if(ctl.keyFingerprint&&ctl.keyFingerprint!==fp)throw Error('Chiave diversa: non modifico la copia');const previous=key;key=candidate;try{if(remote.revision)await readRemote(remote.revision);key=await rememberKey(candidate,fp,revision);}catch(error){key=previous;throw Error('Collegamento non completato: '+error.message+'. Nessuna copia sostituita.');}if(deviceRevision()!==revision){lockKey();throw Error('Dispositivo scollegato durante la verifica.');}S.update({keyFingerprint:fp,enabled:true});native.remove.call(nativeSession,tabKey);stopped=false;input.value='';dialog.close();say('Dispositivo collegato: la chiave verrà ricordata per questo account.');await tick();}));
  content.append(button('Crea chiave per il primo dispositivo',async()=>{const remote=await request('head');if(remote.revision)throw Error('Esiste già una copia cloud: usa la sua chiave');const recovery=createRecovery();input.type='text';input.value=recovery;say('Copia e conserva la chiave, poi premi “Sblocca con questa chiave”.');}));
 };
 document.getElementById('luki-now').onclick=()=>void resumeAndSync();document.getElementById('luki-lock').onclick=async()=>{stopped=true;lockKey();try{await deviceKeys.forget();native.remove.call(nativeSession,tabKey);say('Dispositivo scollegato. Dati locali e copie cloud conservati. Per ricollegarlo usa la stessa chiave.');}catch(error){say('Scollegamento da completare: '+error.message);}};panel.querySelector('a').addEventListener('click',()=>{stopped=true;lockKey();});
 document.getElementById('luki-history').onclick=async()=>{try{show();const p=document.createElement('p');p.textContent='Ogni ripristino crea una nuova generazione sul dispositivo e conserva quella precedente. Le copie non vengono unite automaticamente. Chiudi prima le altre schede dell’app.';content.append(p);if(!key){const note=document.createElement('p');note.textContent='Per verificare e usare una revisione devi prima sbloccare la sincronizzazione con la chiave di questa app.';content.append(note,button('Sblocca per aprire le revisioni',()=>document.getElementById('luki-unlock').click()));}const history=await request('history');for(const row of history.revisions){const line=document.createElement('p');line.textContent=`Revisione ${row.revision} · ${row.created_at} `;line.append(button('Verifica e usa sul dispositivo',async()=>{if(!key)throw Error('Sblocca prima la sincronizzazione');if(transportBusy)throw Error('Attendi la sincronizzazione');transportBusy=true;try{const copy=await readRemote(row.revision),head=await request('head');if(!confirm(`Usare la revisione ${row.revision} su questo dispositivo? La copia locale precedente resta recuperabile. Le modifiche non vengono unite. La copia online non cambia finché non confermi un nuovo caricamento.`))return;await restore(copy.snapshot,head.revision,copy.plainHash,row.revision!==head.revision);}finally{transportBusy=false;}}));content.append(line);}for(const row of history.conflicts){const line=document.createElement('p');line.textContent=`Copia in conflitto ${row.operation_id} · ${row.created_at} `;line.append(button('Verifica e recupera',async()=>{if(!key||transportBusy)throw Error('Sblocca e attendi');transportBusy=true;try{const copy=await readRemote(row.operation_id),remote=await request('head');if(!confirm('Recuperare questa copia in conflitto sul dispositivo? La copia locale precedente e tutte le revisioni online restano conservate.'))return;await restore(copy.snapshot,remote.revision,copy.plainHash,true);}finally{transportBusy=false;}}));content.append(line);}content.append(button('Mantieni la copia locale dopo confronto',async()=>{if(!key||transportBusy)throw Error('Sblocca la sincronizzazione e attendi');if(!confirm('Hai confrontato la copia locale e le revisioni online? Pubblicare questa copia crea una nuova revisione e conserva le precedenti.'))return;const remote=await request('head');S.update({baseRevision:remote.revision,baseHash:null,conflict:null});dialog.close();await tick();}));
  content.append(button('Recupera la generazione locale precedente',async()=>{const db=await transportReady;const keys=await new Promise((resolve,reject)=>{const tx=native.transaction.call(db,'items','readonly'),r=tx.objectStore('items').getAllKeys();tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);});const names=keys.filter(k=>typeof k==='string'&&k.startsWith('generation:'));if(!names.length)throw Error('Nessuna generazione precedente');const copies=await Promise.all(names.map(n=>item(n)));const previous=copies.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0))[0];if(!confirm('Riattivare la copia locale precedente? La copia corrente resta conservata.'))return;await item('generation:'+S.generation,{...S.readControl(),savedAt:Date.now()});native.set.call(nativeLocal,S.controlKey,JSON.stringify({...previous,frozen:false,baseHash:null,conflict:null}));location.reload();}));
 }catch(error){say(error.message);}};
 async function checkIdentity(){try{await request('session');return true;}catch(error){lockKey();if(error.status===401||error.status===403){stopped=true;document.body.replaceChildren(document.createTextNode('Sessione di accesso scaduta o account cambiato. Riapri la pagina per accedere: la chiave di questo dispositivo resta associata al suo account e i dati locali sono conservati.'));}else say('Connessione non disponibile: modifiche salvate sul dispositivo, invio in attesa.');return false;}}
 dialog.addEventListener('close',()=>content.replaceChildren());
 async function resumeAndSync(){
  if(stopped||suspended)return;if(resumePromise)return resumePromise;
  resumePromise=(async()=>{
   const revision=deviceRevision();if(!await checkIdentity()||stopped||suspended||deviceRevision()!==revision)return;
   try{
    if(!key){
     let savedKey=await deviceKeys.load();
     if(!savedKey){
      // Migra soltanto una chiave esistente che corrisponde al fingerprint locale.
      const legacy=JSON.parse(native.get.call(nativeSession,tabKey)||'null');
      if(legacy?.recovery&&revision==='0'){const fp=await hash(recoveryBytes(legacy.recovery));if(fp!==S.readControl().keyFingerprint)throw Error('La chiave di sessione non corrisponde a questo archivio.');savedKey=await deviceKeys.save(await importRecovery(legacy.recovery),fp,revision);native.remove.call(nativeSession,tabKey);}
     }
     if(!savedKey){say('Collega questo dispositivo con la chiave esistente: verrà ricordata per questo account.');return;}
     if(stopped||suspended||deviceRevision()!==revision)return;key=savedKey;say('Sincronizzazione sbloccata con la chiave già associata a questo dispositivo.');
    }
    if(!stopped&&!suspended&&deviceRevision()===revision)await tick();
   }catch(error){lockKey();say('Sincronizzazione sospesa: '+error.message+' Le chiavi salvate e gli archivi restano conservati.');}
  })();try{await resumePromise;}finally{resumePromise=null;}
 }
 window.addEventListener('storage',event=>{if(event.key===deviceRevisionKey){stopped=true;lockKey();native.remove.call(nativeSession,tabKey);say('Dispositivo scollegato da un’altra scheda. Gli archivi restano conservati.');}});
 window.addEventListener('online',()=>void resumeAndSync());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void resumeAndSync();});
 setInterval(()=>void resumeAndSync(),10000);
 window.addEventListener('pagehide',()=>{suspended=true;lockKey();});
 window.addEventListener('pageshow',()=>{suspended=false;void resumeAndSync();});
 void resumeAndSync();
 window.LukiSyncTest={capture,encode,decode,restore,tick,resumeAndSync,storage:S,deviceKeys,getKey:()=>key,seal,open,hash,importRecovery,createRecovery,stable,...(typeof diagnoseClinical==='function'?{diagnoseClinical,rebuildPending}:{}),unlock:async code=>{const fp=await hash(recoveryBytes(code));key=await rememberKey(await importRecovery(code),fp,deviceRevision());S.update({keyFingerprint:fp,enabled:true});stopped=false;}};
})();
