/* Pure native backup validation. No storage, requests, logs or automatic migration. */
(function(root){'use strict';
 const MIME=/^(application\/pdf|image\/(jpeg|png|webp)|text\/plain)$/;
 const MAX=64*1024*1024,MAX_DEPTH=8;
 function error(message){throw Error(message);}
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 async function hash(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function unique(rows){if(!Array.isArray(rows))error('Copia non valida.');const out=new Map();for(const row of rows){if(!object(row)||typeof row.id!=='string'||!row.id||row.id.length>160||out.has(row.id))error('Identificativi mancanti o duplicati nella copia.');out.set(row.id,row);}return out;}
 function recovery(state,depth){if(depth>MAX_DEPTH)error('Troppe copie di azzeramento annidate.');if(state.resetBackup==null)return null;if(!object(state.resetBackup)||!object(state.resetBackup.state))error('Copia precedente all’azzeramento non valida.');return state.resetBackup;}
 function decodeData(value){
  if(typeof value!=='string'||value.length>Math.ceil(MAX/3)*4+100)error('Originale troppo grande o non valido.');
  const match=/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if(!match||!MIME.test(match[1])||match[2].length%4)error('Originale non valido.');
  let text;try{text=atob(match[2]);}catch{error('Originale non valido.');}
  if(!text.length||text.length>MAX||btoa(text)!==match[2])error('Originale vuoto o non valido.');
  return new Blob([Uint8Array.from(text,c=>c.charCodeAt(0))],{type:match[1]});
 }
 async function encodeData(blob){const data=new Uint8Array(await blob.arrayBuffer());let text='';for(let i=0;i<data.length;i+=8192)text+=String.fromCharCode(...data.subarray(i,i+8192));return 'data:'+blob.type+';base64,'+btoa(text);}
 async function prepare(raw){
  if(!object(raw))error('Copia non valida.');
  if(raw.backupVersion!==undefined&&![1,2,3].includes(raw.backupVersion))error('Versione della copia non supportata.');
  const files=new Map(),decoded=new WeakMap();
  async function read(state,ownRows,integrity,inherited,depth){
   if(!object(state))error('Copia non valida.');
   const rb=recovery(state,depth),docs=unique(state.documents),own=unique(ownRows||[]),available=new Map(inherited);
   for(const [id,f]of own){if(!docs.has(id)||typeof f.name!=='string')error('Originale senza documento corrispondente.');if(available.has(id))error('Originale duplicato fra archivio e copia di azzeramento.');available.set(id,f);}
   const originals=new Map([...available].filter(([id])=>docs.has(id)));
   if(integrity!==undefined&&(!object(integrity)||integrity.version!==1))error('Versione dei controlli originali non supportata.');
   const manifest=integrity?unique(integrity.files):null,textOnly=new Set();
   if(integrity){if(!Array.isArray(integrity.textOnly))error('Elenco documenti senza originale non valido.');for(const id of integrity.textOnly){if(typeof id!=='string'||textOnly.has(id))error('Elenco documenti senza originale non valido.');textOnly.add(id);}}
   for(const [id,f]of originals){
    let checked=decoded.get(f);if(!checked){const blob=decodeData(f.data);checked={blob,sha256:await hash(blob)};decoded.set(f,checked);}
    const {blob,sha256}=checked;
    if(manifest){const record=manifest.get(id);if(!record||record.size!==blob.size||record.type!==blob.type||record.sha256!==sha256)error('Originale incompleto o danneggiato. Nessun dato è stato sostituito.');}
    files.set(id,{id,name:f.name,blob});
   }
   for(const [id,doc]of docs){
    if(originals.has(id)){if(doc.originalMode==='text-only'||textOnly.has(id))error('Indicazione originale non coerente.');continue;}
    if(!integrity||doc.originalMode!=='text-only'||typeof doc.text!=='string'||!textOnly.has(id))error('Manca un documento originale nella copia, anche precedente all’azzeramento. Nessun dato è stato sostituito.');
   }
   if(manifest&&(manifest.size!==originals.size||[...manifest.keys()].some(id=>!originals.has(id))||[...textOnly].some(id=>!docs.has(id)||originals.has(id))))error('Copia incompleta: indice originali non coerente.');
   if(rb)await read(rb.state,rb.originalFiles,rb.originalFileIntegrity,available,depth+1);
  }
  await read(raw,raw.originalFiles,raw.originalFileIntegrity,new Map(),0);return [...files.values()];
 }
 function assertAvailable(state,stored){
  const available=unique(stored);
  function check(current,depth){const rb=recovery(current,depth);for(const [id,doc]of unique(current.documents)){const f=available.get(id);if(f){if(!(f.blob instanceof Blob)||!f.blob.size||f.blob.size>MAX||!MIME.test(f.blob.type))error('Originale non valido.');}else if(doc.originalMode!=='text-only'||typeof doc.text!=='string')error('Originale mancante per il documento "'+String(doc.name||'Senza nome').slice(0,120)+'" (ID '+String(id).slice(0,80)+'). Il backup completo non può essere creato finché l’originale non viene recuperato. Nessun dato è stato sostituito.');}if(rb)check(rb.state,depth+1);}
  check(state,0);return true;
 }
 function withoutOriginals(state){
  const copy=structuredClone(state);
  function clean(current,depth){const rb=recovery(current,depth);delete current.originalFiles;delete current.originalFileIntegrity;if(rb){delete rb.originalFiles;delete rb.originalFileIntegrity;clean(rb.state,depth+1);}}
  clean(copy,0);return copy;
 }
 async function create(state,stored){
  const snapshot=withoutOriginals(state),available=unique(stored),encoded=new Map();assertAvailable(snapshot,stored);
  async function pack(current,inherited,depth){
   const rb=recovery(current,depth),originalFiles=[],checks=[],textOnly=[],known=new Set(inherited);
   for(const [id,doc]of unique(current.documents)){
    const f=available.get(id);if(!f){textOnly.push(id);continue;}
    let cached=encoded.get(id);if(!cached){cached={id,name:String(f.name||doc.name||'Documento'),data:await encodeData(f.blob),size:f.blob.size,type:f.blob.type,sha256:await hash(f.blob)};encoded.set(id,cached);}
    doc.originalMode='file';const {name,data,size,type,sha256}=cached;
    if(!known.has(id)){originalFiles.push({id,name,data});known.add(id);}checks.push({id,size,type,sha256});
   }
   if(rb){const nested=await pack(rb.state,known,depth+1);rb.originalFiles=nested.originalFiles;rb.originalFileIntegrity=nested.originalFileIntegrity;}
   return {originalFiles,originalFileIntegrity:{version:1,files:checks,textOnly}};
  }
  const packed=await pack(snapshot,new Set(),0),copy={...snapshot,backupVersion:3,exportedAt:new Date().toISOString(),...packed};await prepare(copy);return copy;
 }
 async function prepareMerge(raw,stored){
  const currentIds=new Set(unique(raw.documents).keys()),incoming=(await prepare(raw)).filter(f=>currentIds.has(f.id)),existing=unique(stored),files=[],existingIds=[];
  for(const file of incoming){const old=existing.get(file.id);if(!old){files.push(file);continue;}if(!(old.blob instanceof Blob)||old.blob.size!==file.blob.size||await hash(old.blob)!==await hash(file.blob))error('Un originale con lo stesso identificativo ha un contenuto diverso. Nessun dato è stato sostituito.');existingIds.push(file.id);}
  return {files,existingIds};
 }
 root.TFBackupIntegrity={prepare,create,prepareMerge,assertAvailable,withoutOriginals};
 if(typeof module!=='undefined')module.exports=root.TFBackupIntegrity;
})(globalThis);
