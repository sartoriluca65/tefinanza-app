// Explicit conversion of COPIES of previous native JSON formats; no storage writes or migration.
import {createBackup} from './backup.mjs';
import './finance-originals.js';
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
    let files;try{files=await globalThis.TFBackupIntegrity.prepare(raw);}catch{throw Error(raw.originalFileIntegrity!==undefined||raw.resetBackup?.originalFileIntegrity!==undefined?'INVALID_ORIGINAL_MANIFEST':'MISSING_ATTACHMENT');}
    const current=globalThis.TFBackupIntegrity.withoutOriginals(raw);
    const entries=files.map(value=>({key:value.id,value}));
    snapshot.databases=[{name:'TeFinanza-family',stores:[{name:'state',entries:[{key:'current',value:current}]},{name:'files',entries}]}];
  }else throw Error('USE_EXISTING_NATIVE_READER_ON_ISOLATED_COPY');
  return {backup:await createBackup(spec,snapshot),scope:spec.kind==='rifornio'?'LEGACY_VEHICLES_AND_REFUELS_ONLY':'LEGACY_CONTENT_ONLY'};
}
