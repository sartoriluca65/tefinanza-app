/* Native JSON backup validation. No storage writes, requests, logs or automatic migration. */
(function(root){'use strict';
 const MIME=/^(application\/pdf|image\/(jpeg|png|webp)|text\/plain)$/;
 const MAX=64*1024*1024;
 function error(message){throw Error(message);}
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 async function hash(blob){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function unique(rows){if(!Array.isArray(rows))error('Copia non valida.');const out=new Map();for(const row of rows){if(!object(row)||typeof row.id!=='string'||!row.id||row.id.length>160||out.has(row.id))error('Identificativi mancanti o duplicati nella copia.');out.set(row.id,row);}return out;}
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
  const docs=unique(raw.documents), originals=unique(raw.originalFiles||[]),files=[];
  const integrity=raw.originalFileIntegrity;
  if(integrity!==undefined&&(!object(integrity)||integrity.version!==1))error('Versione dei controlli originali non supportata.');
  const manifest=integrity?unique(integrity.files):null,textOnly=new Set();
  if(integrity){if(!Array.isArray(integrity.textOnly))error('Elenco documenti senza originale non valido.');for(const id of integrity.textOnly){if(typeof id!=='string'||textOnly.has(id))error('Elenco documenti senza originale non valido.');textOnly.add(id);}}
  for(const [id,f] of originals){
   if(!docs.has(id)||typeof f.name!=='string')error('Originale senza documento corrispondente.');
   const blob=decodeData(f.data);
   if(manifest){const record=manifest.get(id);if(!record||record.size!==blob.size||record.type!==blob.type||!/^([a-f0-9]{64})$/.test(record.sha256)||await hash(blob)!==record.sha256)error('Originale incompleto o danneggiato. Nessun dato è stato sostituito.');}
   files.push({id,name:f.name,blob});
  }
  for(const [id,doc]of docs){
   if(originals.has(id)){if(doc.originalMode==='text-only'||textOnly.has(id))error('Indicazione originale non coerente.');continue;}
   // Only new, explicit manifests may declare a deliberately text-only record.
   if(!integrity||doc.originalMode!=='text-only'||typeof doc.text!=='string'||!textOnly.has(id))error('Manca un documento originale nella copia. Nessun dato è stato sostituito.');
  }
  if(manifest&&(manifest.size!==originals.size||[...manifest.keys()].some(id=>!originals.has(id))||[...textOnly].some(id=>!docs.has(id)||originals.has(id))))error('Copia incompleta: indice originali non coerente.');
  return files;
 }
 async function create(state,stored){
  const snapshot=structuredClone(state),docs=unique(snapshot.documents),available=unique(stored),originalFiles=[],checks=[],textOnly=[];
  for(const [id,doc]of docs){
   const f=available.get(id);
   if(!f){if(doc.originalMode!=='text-only'||typeof doc.text!=='string')error('Manca un documento originale. Ricollegalo prima di creare una copia completa.');textOnly.push(id);continue;}
   if(!(f.blob instanceof Blob)||!f.blob.size||f.blob.size>MAX||!MIME.test(f.blob.type))error('Originale vuoto, troppo grande o non supportato.');
   doc.originalMode='file';originalFiles.push({id,name:String(f.name||doc.name),data:await encodeData(f.blob)});
   checks.push({id,size:f.blob.size,type:f.blob.type,sha256:await hash(f.blob)});
  }
  const copy={...snapshot,backupVersion:3,exportedAt:new Date().toISOString(),originalFiles,originalFileIntegrity:{version:1,files:checks,textOnly}};
  await prepare(copy);return copy;
 }
 root.TFBackupIntegrity={prepare,create};
 if(typeof module!=='undefined')module.exports=root.TFBackupIntegrity;
})(globalThis);
