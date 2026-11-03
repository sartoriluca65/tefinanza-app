// Explicit conversion of COPIES of previous native JSON formats; no storage writes or migration.
import {createBackup,sha256} from './backup.mjs';
export async function importLegacyJSON(spec,text) {
  if(typeof text!=='string'||text.length>64*1024*1024)throw Error('INVALID_SIZE');
  let raw;try{raw=JSON.parse(text);}catch{throw Error('INVALID_JSON');}
  const snapshot={localStorage:{},databases:[]};
  if(spec.kind==='diviso')snapshot.localStorage['diviso-v2']=text;
  else if(spec.kind==='rifornio'){
    if(raw?.app!=='Rifornio'||raw.schemaVersion!==1||!Array.isArray(raw.vehicles)||!Array.isArray(raw.entries))throw Error('INCOMPATIBLE_LEGACY_FORMAT');
    snapshot.localStorage.rifornioVehicles=JSON.stringify(raw.vehicles);snapshot.localStorage.rifornioEntries=JSON.stringify(raw.entries);
    // Older native exports never contained trips: do not claim those have been recovered.
  }else if(spec.kind==='cochi'){
    if(raw?.format==='cochi-backup-encrypted')throw Error('USE_EXISTING_LOCAL_DECRYPTION_TOOL_ON_ISOLATED_COPY');
    snapshot.localStorage[spec.stateKey]=text;
  }else if(spec.kind==='tefinanza'){
    if(raw?.backupVersion!==3||!Array.isArray(raw.originalFiles))throw Error('INCOMPATIBLE_LEGACY_FORMAT');
    const current=structuredClone(raw);delete current.originalFiles;
    const entries=[];
    for(const f of raw.originalFiles){
      const m=typeof f.data==='string'&&/^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/.exec(f.data);
      if(!m)throw Error('INVALID_ATTACHMENT');
      let data;try{data=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));}catch{throw Error('INVALID_ATTACHMENT');}
      entries.push({key:f.id,value:{id:f.id,name:f.name,blob:new Blob([data],{type:m[1]})}});
    }
    // Explicit text-only declarations in native JSON require their complete native manifest.
    const manifest=raw.originalFileIntegrity;
    if(manifest!==undefined){
      if(!manifest||manifest.version!==1||!Array.isArray(manifest.files)||!Array.isArray(manifest.textOnly)||!Array.isArray(raw.documents))throw Error('INVALID_ORIGINAL_MANIFEST');
      const docs=new Map(raw.documents.map(d=>[d.id,d])),checks=new Map(),textOnly=new Set(),ids=new Set();
      if(docs.size!==raw.documents.length)throw Error('INVALID_ORIGINAL_MANIFEST');
      for(const record of manifest.files){if(!record||typeof record.id!=='string'||checks.has(record.id))throw Error('INVALID_ORIGINAL_MANIFEST');checks.set(record.id,record);}
      for(const id of manifest.textOnly){if(typeof id!=='string'||textOnly.has(id)||!docs.has(id)||docs.get(id).originalMode!=='text-only'||typeof docs.get(id).text!=='string')throw Error('INVALID_ORIGINAL_MANIFEST');textOnly.add(id);}
      for(const {value:f} of entries){const record=checks.get(f.id);if(ids.has(f.id)||!docs.has(f.id)||textOnly.has(f.id)||!record||record.size!==f.blob.size||record.type!==f.blob.type||record.sha256!==await sha256(await f.blob.arrayBuffer()))throw Error('INVALID_ORIGINAL_MANIFEST');ids.add(f.id);}
      if(checks.size!==ids.size||raw.documents.some(d=>!ids.has(d.id)&&!textOnly.has(d.id)))throw Error('INVALID_ORIGINAL_MANIFEST');
    }else if(raw.documents?.some(d=>d.originalMode==='text-only'))throw Error('MISSING_ORIGINAL_MANIFEST');
    snapshot.databases=[{name:'TeFinanza-family',stores:[{name:'state',entries:[{key:'current',value:current}]},{name:'files',entries}]}];
  }else throw Error('USE_EXISTING_NATIVE_READER_ON_ISOLATED_COPY');
  return {backup:await createBackup(spec,snapshot),scope:spec.kind==='rifornio'?'LEGACY_VEHICLES_AND_REFUELS_ONLY':'LEGACY_CONTENT_ONLY'};
}
