/* Phase 0B: explicit read-only capture and restore into a NEW isolated sandbox.
 * No network, automatic migration, credentials, or application storage writes. */
const FORMAT = 'luki-isolated-backup';
const MAX_BYTES = 64 * 1024 * 1024;
const enc = new TextEncoder();
const fail = code => { throw new Error(code); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const bytes = x => new Uint8Array(x);
export async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))]
    .map(x => x.toString(16).padStart(2, '0')).join('');
}
function base64(data) {
  let out = '';
  for (let i = 0; i < data.length; i += 8192) out += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(out);
}
function unbase64(s) {
  if (typeof s !== 'string' || s.length % 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) fail('INVALID_BASE64');
  const data = Uint8Array.from(atob(s), c => c.charCodeAt(0));
  if (base64(data) !== s) fail('INVALID_BASE64');
  return data;
}
export async function encode(value, depth = 0) {
  if (depth > 80) fail('TOO_DEEP');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fail('NON_FINITE');
  if (value instanceof Blob) {
    if (value.size > MAX_BYTES) fail('TOO_LARGE');
    return {type:'blob', mime:value.type, data:base64(new Uint8Array(await value.arrayBuffer()))};
  }
  if (value instanceof ArrayBuffer) return {type:'buffer', data:base64(bytes(value))};
  if (value instanceof Uint8Array) return {type:'uint8', data:base64(value)};
  if (Array.isArray(value)) return {type:'array', items:await Promise.all(value.map(x => encode(x, depth+1)))};
  if (object(value) && Object.getPrototypeOf(value) === Object.prototype) {
    const entries=[];
    for (const key of Object.keys(value).sort()) entries.push([key, await encode(value[key], depth+1)]);
    return {type:'object', entries};
  }
  fail('UNSUPPORTED_VALUE');
}
export function decode(value, depth = 0) {
  if (depth > 80) fail('TOO_DEEP');
  if (value === null || ['string','boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fail('NON_FINITE');
  if (!object(value)) fail('INVALID_ENCODING');
  if (value.type === 'blob' && typeof value.mime === 'string') return new Blob([unbase64(value.data)], {type:value.mime});
  if (value.type === 'buffer') return unbase64(value.data).buffer;
  if (value.type === 'uint8') return unbase64(value.data);
  if (value.type === 'array' && Array.isArray(value.items)) return value.items.map(x=>decode(x,depth+1));
  if (value.type === 'object' && Array.isArray(value.entries)) {
    const out={}; const seen=new Set();
    for (const pair of value.entries) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== 'string' || seen.has(pair[0])) fail('INVALID_ENCODING');
      seen.add(pair[0]); Object.defineProperty(out,pair[0],{value:decode(pair[1],depth+1),enumerable:true,writable:true,configurable:true});
    }
    return out;
  }
  fail('INVALID_ENCODING');
}
function readJSON(ls,key,required=false) {
  if (!(key in ls)) return required ? fail('MISSING_STATE') : null;
  try { return JSON.parse(ls[key]); } catch { fail('INVALID_JSON'); }
}
function unique(rows,field='id') {
  if (!Array.isArray(rows)) fail('INVALID_ARRAY');
  const ids=new Set();
  for (const row of rows) {
    if (!object(row) || !['string','number'].includes(typeof row[field]) || ids.has(row[field])) fail('DUPLICATE_OR_INVALID_ID');
    ids.add(row[field]);
  }
  return ids;
}
function walkRefs(value,refs=new Set(),depth=0) {
  if (depth>80) fail('TOO_DEEP');
  if (!value || typeof value !== 'object' || value instanceof Blob) return refs;
  if (typeof value.fileKey === 'string') {
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value.fileKey))fail('INVALID_ATTACHMENT_ID');
    refs.add(value.fileKey);
  }
  for (const item of Object.values(value)) walkRefs(item,refs,depth+1);
  return refs;
}
function stores(snapshot,name,store) {
  const db=snapshot.databases.find(d=>d.name===name);
  return db?.stores.find(s=>s.name===store)?.entries || [];
}
function records(snapshot,name,store) { return stores(snapshot,name,store).map(x=>x.value); }
function validImage(value) {
  const match=typeof value==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
  if(!match)return false;try{return unbase64(match[1]).length>0;}catch{return false;}
}
export function validateSnapshot(spec,snapshot) {
  if (!object(snapshot) || Object.keys(snapshot).sort().join(',')!=='databases,localStorage' || !object(snapshot.localStorage) || !Array.isArray(snapshot.databases)) fail('INVALID_SNAPSHOT');
  const allowed=new Set(spec.localKeys);
  for (const [key,value] of Object.entries(snapshot.localStorage)) if (!allowed.has(key)||typeof value!=='string') fail('OUT_OF_SCOPE_KEY');
  const dbNames=new Set();
  for (const db of snapshot.databases) {
    const expected=spec.databases.find(d=>d.name===db.name);
    if (!expected || dbNames.has(db.name) || !Array.isArray(db.stores)) fail('OUT_OF_SCOPE_DATABASE');
    dbNames.add(db.name); const seenStores=new Set();
    for (const st of db.stores) {
      if (!expected.stores.includes(st.name)||seenStores.has(st.name)||!Array.isArray(st.entries)) fail('OUT_OF_SCOPE_STORE');
      seenStores.add(st.name); const seenKeys=new Set();
      for (const row of st.entries) {
        if (!object(row)||!('key' in row)||!('value' in row)) fail('INVALID_RECORD');
        const k=JSON.stringify(row.key);if(seenKeys.has(k))fail('DUPLICATE_KEY');seenKeys.add(k);
        const allowedKeys=expected.keysByStore?.[st.name]||expected.keys;
        if (allowedKeys && !allowedKeys.includes(row.key)) fail('OUT_OF_SCOPE_RECORD');
      }
    }
    if (expected.stores.some(n=>!seenStores.has(n))) fail('MISSING_STORE');
  }
  const ls=snapshot.localStorage;
  if (spec.kind==='diviso') {
    const s=readJSON(ls,'diviso-v2',true),people=unique(s.people);unique(s.expenses);unique(s.groups||[]);
    for (const e of s.expenses) if (!Array.isArray(e.who)||e.who.some(id=>!people.has(id))||!Number.isFinite(Number(String(e.amount).replace(',','.')))) fail('INVALID_EXPENSE');
    for (const g of s.groups||[]) if (!Array.isArray(g.people)||g.people.some(id=>!people.has(id))) fail('INVALID_GROUP');
  } else if (spec.kind==='rifornio') {
    const vehicles=readJSON(ls,'rifornioVehicles',true),ids=unique(vehicles),entries=readJSON(ls,'rifornioEntries',true);unique(entries);
    for(const vehicle of vehicles)if(typeof vehicle.name!=='string'||!vehicle.name.trim()||vehicle.fuel!==undefined&&typeof vehicle.fuel!=='string'||vehicle.consumption!==undefined&&(!Number.isFinite(vehicle.consumption)||vehicle.consumption<=0))fail('INVALID_VEHICLE');
    // Removed vehicles are allowed: the original application retains their history.
    for(const row of entries)if(typeof row.vehicleId!=='string'||!Number.isFinite(row.quantity)||!Number.isFinite(row.price))fail('INVALID_ENTRY');
    for(const key of ['pienosmartTripDraftV1','pienosmartRecordedTrips'])if(key in ls)readJSON(ls,key,true);
  } else if (spec.kind==='cochi') {
    const s=readJSON(ls,spec.stateKey,true);unique(s.rows);
    for(const row of s.rows)if(!Number.isSafeInteger(row.id)||!Number.isSafeInteger(row.income)||!Number.isSafeInteger(row.expense)||row.income<0||row.expense<0||(row.income>0)===(row.expense>0)||typeof row.description!=='string'||typeof row.date!=='string')fail('INVALID_MOVEMENT');
    if(!Array.isArray(s.historic)||!s.historic.length||s.historic.some(p=>!['Assunta','Luca','Rosanna','Giuliano'].includes(p))||new Set(s.historic).size!==s.historic.length||!Array.isArray(s.log)||s.log.some(x=>typeof x!=='string'))fail('INCOMPLETE_STATE');
  } else if (spec.kind==='stickers') {
    const packs=readJSON(ls,'ss-packs',true),meta=readJSON(ls,'ss-stickers',true);unique(packs);unique(meta);
    const images=records(snapshot,'luki-stickers','stickers');unique(images);
    const byId=new Map(images.map(x=>[x.id,x]));
    for(const sticker of meta)if(!validImage(sticker.image)&&!validImage(byId.get(sticker.id)?.image)&&(!sticker.emoji||sticker.image))fail('MISSING_ATTACHMENT');
    for(const sticker of images)if(!validImage(sticker.image)&&(!sticker.emoji||sticker.image))fail('INVALID_ATTACHMENT');
  } else if (spec.kind==='tefinanza') {
    const rows=stores(snapshot,'TeFinanza-family','state'),current=rows.find(x=>x.key==='current')?.value;
    if(!current)fail('MISSING_STATE');
    for(const field of ['accounts','movements','documents','positions'])unique(current[field]);
    const files=records(snapshot,'TeFinanza-family','files');unique(files);const byId=new Map(files.map(f=>[f.id,f]));
    const checkFiles=state=>{if(!object(state)||!Array.isArray(state.documents))fail('INCOMPLETE_STATE');for(const doc of state.documents)if(!byId.has(doc.id))fail('MISSING_ATTACHMENT');};
    checkFiles(current);
    if(current.resetBackup?.state)checkFiles(current.resetBackup.state);
    const safety=rows.find(x=>x.key==='restoreSafety')?.value;
    if(safety){if(!object(safety.state)||!Array.isArray(safety.files))fail('INCOMPLETE_SAFETY_COPY');const safetyIds=unique(safety.files);for(const f of safety.files)if(!(f.blob instanceof Blob)||!f.blob.size)fail('INVALID_ATTACHMENT');for(const doc of safety.state.documents||[])if(!safetyIds.has(doc.id))fail('MISSING_ATTACHMENT');}
    for(const f of files)if(!(f.blob instanceof Blob)||!f.blob.size)fail('INVALID_ATTACHMENT');
  } else if (spec.kind==='clinical') {
    const rows=stores(snapshot,spec.databases[0].name,'cache'),s=rows.find(x=>x.key==='state')?.value;
    const archive=s?.data || readJSON(ls,spec.fallbackKey)?.data;
    if(!object(archive))fail('MISSING_STATE');
    if(!object(archive.paziente))fail('INCOMPLETE_PATIENT');
    if(archive.paziente.gruppoSanguigno!==undefined&&!['','A+','A-','B+','B-','AB+','AB-','0+','0-'].includes(archive.paziente.gruppoSanguigno))fail('INVALID_PATIENT');
    for(const field of ['farmaci','assunzioni','eventi','documenti','controlli','esamiRoutine']){if(!Array.isArray(archive[field]))fail('INCOMPLETE_STATE');unique(archive[field]);if(archive[field].some(row=>typeof row.id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(row.id)))fail('INVALID_CLINICAL_RECORD');}
    if(archive.eventi.some(row=>typeof row.data!=='string'))fail('INVALID_CLINICAL_RECORD');
    const files=records(snapshot,spec.databases[1].name,'files'),byKey=new Map(files.map(f=>[f.key,f]));
    for(const file of files)if(!(file.blob instanceof Blob)||!file.blob.size)fail('INVALID_ATTACHMENT');
    // Include safety state references too: restoration must not strand undo data.
    const refs=walkRefs(archive);for(const row of rows)walkRefs(row.value,refs);
    for(const key of refs)if(!byKey.has(key))fail('MISSING_ATTACHMENT');
    const fallbackSafety=readJSON(ls,'terapia-demo-fallback-beforeRestore'+(spec.id==='clinical-main'?'':'::family:'+spec.id.slice('clinical-'.length)));
    if(fallbackSafety)for(const key of walkRefs(fallbackSafety))if(!byKey.has(key))fail('MISSING_ATTACHMENT');
  } else if (spec.kind==='vault') {
    const s=readJSON(ls,'luca-sartori-ricorda-demo-protected-v2',true);
    if(s?.version!==2||!object(s.pin)||!object(s.recovery)||!object(s.payload))fail('INCOMPLETE_VAULT');
    for(const wrapper of [s.pin,s.recovery])for(const field of ['salt','iv','box'])if(typeof wrapper[field]!=='string'||!wrapper[field])fail('INCOMPLETE_VAULT');
    if(typeof s.payload.iv!=='string'||typeof s.payload.box!=='string')fail('INCOMPLETE_VAULT');
  } else if (spec.kind==='autocontrol') {
    const s=readJSON(ls,spec.stateKey,true),files=records(snapshot,'autocontrol-documents','scans'),byId=new Map(files.map(f=>[f.id,f]));
    for(const field of ['vehicles','maintenance','fuel','parts','documents','insurance','tax','revision','bodywork','deadlines','accessories','workshops'])unique(s[field]);
    const checkDocs=state=>{if(!object(state)||!Array.isArray(state.documents))fail('INCOMPLETE_STATE');for(const doc of state.documents){if(doc.attachmentUnavailable||!Array.isArray(doc.files)||!doc.files.length)fail('MISSING_ATTACHMENT');for(const ref of doc.files)if(!(byId.get(ref.id)?.blob instanceof Blob)||!byId.get(ref.id).blob.size)fail('MISSING_ATTACHMENT');}};
    checkDocs(s);
    for(const key of spec.localKeys)if(key.startsWith('autocontrol-draft-')&&key in ls){const draft=readJSON(ls,key,true);checkDocs(draft.base);checkDocs(draft.payload);}
    for(const row of records(snapshot,'autocontrol-safety','snapshots')){if(typeof row.raw!=='string')fail('INCOMPLETE_SAFETY_COPY');let previous;try{previous=JSON.parse(row.raw);}catch{fail('INCOMPLETE_SAFETY_COPY');}checkDocs(previous);}
  } else fail('UNKNOWN_APPLICATION');
  return true;
}
function validateSpec(spec) {
  if(!object(spec)||typeof spec.id!=='string'||!Array.isArray(spec.localKeys)||!Array.isArray(spec.databases))fail('INVALID_SPEC');
}
export async function createBackup(spec,snapshot) {
  validateSpec(spec);validateSnapshot(spec,snapshot);
  const payload=await encode(snapshot),body=JSON.stringify(payload);
  if(enc.encode(body).length>MAX_BYTES)fail('TOO_LARGE');
  return {format:FORMAT,version:1,app:spec.id,payload,sha256:await sha256(enc.encode(body))};
}
export async function verifyBackup(spec,input) {
  validateSpec(spec);
  if(typeof input==='string'){if(enc.encode(input).length>MAX_BYTES)fail('TOO_LARGE');try{input=JSON.parse(input);}catch{fail('INVALID_JSON');}}
  if(!object(input)||input.format!==FORMAT||input.version!==1||input.app!==spec.id)fail('INCOMPATIBLE_FORMAT');
  const body=JSON.stringify(input.payload);if(enc.encode(body).length>MAX_BYTES)fail('TOO_LARGE');
  if(await sha256(enc.encode(body))!==input.sha256)fail('INTEGRITY_FAILURE');
  const snapshot=decode(input.payload);validateSnapshot(spec,snapshot);return snapshot;
}
export async function capture(spec,source,{signal}={}) {
  validateSpec(spec);
  const check=()=>{if(signal?.aborted)fail('INTERRUPTED');};
  async function read(){
    check();const localStorage={};
    for(const key of spec.localKeys){check();const value=source.getItem(key);if(value!==null)Object.defineProperty(localStorage,key,{value,enumerable:true});}
    const databases=[];
    for(const definition of spec.databases){check();const db=await source.readDatabase(definition);if(db)databases.push(db);}
    check();return {localStorage,databases};
  }
  const first=await read(),second=await read();
  if(JSON.stringify(await encode(first))!==JSON.stringify(await encode(second)))fail('SOURCE_CHANGED');
  check();return createBackup(spec,first);
}
export function browserSource(win) {
  // Explicit construction only. Importing this module does not inspect a browser.
  return {
    getItem:key=>win.localStorage.getItem(key),
    async readDatabase(definition){
      if(typeof win.indexedDB.databases!=='function')fail('DATABASE_ENUMERATION_UNAVAILABLE');
      const existing=await win.indexedDB.databases();if(!existing.some(d=>d.name===definition.name))return null;
      return new Promise((resolve,reject)=>{
        const req=win.indexedDB.open(definition.name);
        req.onupgradeneeded=()=>{req.transaction.abort();}; // Never create a missing database.
        req.onerror=()=>reject(Error('DATABASE_UNAVAILABLE'));req.onblocked=()=>reject(Error('DATABASE_BLOCKED'));
        req.onsuccess=()=>{
          const db=req.result;
          if(definition.stores.some(s=>!db.objectStoreNames.contains(s))){db.close();reject(Error('MISSING_STORE'));return;}
          const out={name:definition.name,stores:[]},tx=db.transaction(definition.stores,'readonly');
          for(const name of definition.stores){const entries=[],store=tx.objectStore(name),cursor=store.openCursor(),allowedKeys=definition.keysByStore?.[name]||definition.keys;out.stores.push({name,entries});cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(!allowedKeys||allowedKeys.includes(c.key))entries.push({key:c.key,value:c.value});c.continue();};}
          tx.oncomplete=()=>{db.close();resolve(out);};tx.onabort=tx.onerror=()=>{db.close();reject(Error('DATABASE_READ_FAILED'));};
        };
      });
    }
  };
}
export async function prepareRestore(spec,input) {
  // A plan only: no application database/localStorage setter exists here.
  const snapshot=await verifyBackup(spec,input);return {app:spec.id,snapshot};
}
export async function restoreToNewSandbox(spec,input,target,{signal}={}) {
  const plan=await prepareRestore(spec,input);
  if(signal?.aborted)fail('INTERRUPTED');
  if(!target||!/^backup-preparation-[a-zA-Z0-9-]+$/.test(target.name)||target.exists!==false)fail('SANDBOX_NOT_EMPTY');
  // Target contract: atomic insertion into a brand-new namespace; never replace.
  await target.insertNew(plan,{signal});return {status:'RESTORED_IN_SANDBOX',app:spec.id};
}
export function browserSandbox(win,name='backup-preparation-'+crypto.randomUUID()) {
  if(!['localhost','127.0.0.1','[::1]'].includes(win.location.hostname))fail('ISOLATED_ORIGIN_REQUIRED');
  if(!/^backup-preparation-[a-zA-Z0-9-]+$/.test(name))fail('INVALID_SANDBOX_NAME');
  return {name,exists:false,async insertNew(plan,{signal}={}){
    const list=await win.indexedDB.databases();if(list.some(x=>x.name===name))fail('SANDBOX_NOT_EMPTY');
    await new Promise((resolve,reject)=>{const req=win.indexedDB.open(name,1);let fresh=false;
      req.onupgradeneeded=()=>{fresh=true;req.result.createObjectStore('restore-plan');};
      req.onerror=()=>reject(Error('SANDBOX_OPEN_FAILED'));
      req.onsuccess=()=>{const db=req.result;if(!fresh){db.close();reject(Error('SANDBOX_NOT_EMPTY'));return;}
        const tx=db.transaction('restore-plan','readwrite');const abort=()=>{try{tx.abort();}catch{}};
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted)tx.abort();else tx.objectStore('restore-plan').add(plan,'verified');
        tx.oncomplete=()=>{signal?.removeEventListener('abort',abort);db.close();resolve();};
        tx.onabort=tx.onerror=()=>{signal?.removeEventListener('abort',abort);db.close();reject(Error('SANDBOX_WRITE_FAILED'));};
      };
    });
  }};
}
export async function downloadBackup(spec,backup,win) {
  await verifyBackup(spec,backup);
  const blob=new Blob([JSON.stringify(backup)],{type:'application/json'}),url=win.URL.createObjectURL(blob),a=win.document.createElement('a');
  a.href=url;a.download=spec.id+'-backup.json';a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),30000);
  return {status:'DOWNLOAD_REQUESTED_NOT_VERIFIED'};
}
