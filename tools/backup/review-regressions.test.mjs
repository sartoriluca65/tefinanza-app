import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackup,verifyBackup,capture} from './backup.mjs';
import {tefinanza,rifornio} from './profiles.mjs';
import {fixture} from './fixture.mjs';
import {importLegacyJSON} from './legacy.mjs';
const textDoc=()=>({id:'synthetic-text',text:'SYNTHETIC_TEXT',originalMode:'text-only'});
test('toolkit preserves intentional text-only state, reset copy and safety copy',async()=>{
 const s=fixture(tefinanza),state=s.databases[0].stores[0].entries[0].value;state.documents=[textDoc()];state.resetBackup={state:{documents:[textDoc()]}};
 s.databases[0].stores[0].entries.push({key:'restoreSafety',value:{state:{documents:[textDoc()]},files:[]}});
 assert.deepEqual(await verifyBackup(tefinanza,await createBackup(tefinanza,s)),s);
});
test('toolkit still refuses ambiguous or malformed missing-original documents',async()=>{for(const change of [d=>delete d.originalMode,d=>delete d.text,d=>d.originalMode='file']){const s=fixture(tefinanza),d=textDoc();change(d);s.databases[0].stores[0].entries[0].value.documents=[d];await assert.rejects(()=>createBackup(tefinanza,s),/MISSING_ATTACHMENT/)}});
test('native text-only JSON conversion requires a coherent explicit manifest',async()=>{
 const raw={backupVersion:3,accounts:[],movements:[],positions:[],documents:[textDoc()],originalFiles:[],originalFileIntegrity:{version:1,files:[],textOnly:['synthetic-text']}};
 const {backup}=await importLegacyJSON(tefinanza,JSON.stringify(raw));const s=await verifyBackup(tefinanza,backup);assert.equal(s.databases[0].stores[0].entries[0].value.documents[0].text,'SYNTHETIC_TEXT');
 for(const change of [x=>delete x.originalFileIntegrity,x=>x.originalFileIntegrity.textOnly=[],x=>x.originalFileIntegrity.textOnly.push('unlinked'),x=>x.originalFileIntegrity.version=99]){const x=structuredClone(raw);change(x);await assert.rejects(()=>importLegacyJSON(tefinanza,JSON.stringify(x)))}
});
test('native original checksum and manifest completeness survive toolkit conversion',async()=>{
 const {sha256}=await import('./backup.mjs'),bytes=new TextEncoder().encode('SYNTHETIC');
 const raw={backupVersion:3,accounts:[],movements:[],positions:[],documents:[{id:'synthetic-file',originalMode:'file'}],originalFiles:[{id:'synthetic-file',name:'SYNTHETIC.txt',data:'data:text/plain;base64,U1lOVEhFVElD'}],originalFileIntegrity:{version:1,files:[{id:'synthetic-file',size:9,type:'text/plain',sha256:await sha256(bytes)}],textOnly:[]}};
 await importLegacyJSON(tefinanza,JSON.stringify(raw));for(const change of [x=>x.originalFileIntegrity.files[0].sha256='0'.repeat(64),x=>x.originalFileIntegrity.files=[],x=>x.originalFiles=[]]){const x=structuredClone(raw);change(x);await assert.rejects(()=>importLegacyJSON(tefinanza,JSON.stringify(x)),/INVALID_ORIGINAL_MANIFEST/)}
});
const journal=phase=>({version:1,phase,previous:{rifornioVehicles:'[{"id":"synthetic-old","name":"SYNTHETIC_OLD"}]',rifornioEntries:'[]'}});
test('pending Rifornio recovery blocks partial backup without changing source',async()=>{
 const s=fixture(rifornio);s.localStorage.rifornioVehicles='[{"id":"synthetic-new","name":"SYNTHETIC_NEW"}]';s.localStorage['rifornio-before-import-v1']=JSON.stringify(journal('pending'));const before=JSON.stringify(s);
 await assert.rejects(()=>capture(rifornio,{getItem:k=>s.localStorage[k]??null}),/RECOVERY_PENDING/);assert.equal(JSON.stringify(s),before);
});
test('completed recovery journals are included byte-identically; old backups still accepted',async()=>{
 for(const phase of ['committed','rolled-back']){const s=fixture(rifornio),value=' '+JSON.stringify(journal(phase))+' ';s.localStorage['rifornio-before-import-v1']=value;const restored=await verifyBackup(rifornio,await capture(rifornio,{getItem:k=>s.localStorage[k]??null}));assert.equal(restored.localStorage['rifornio-before-import-v1'],value)}
 const legacy=fixture(rifornio);assert.deepEqual(await verifyBackup(rifornio,await createBackup(rifornio,legacy)),legacy);
});
test('malformed recovery journal is never silently omitted',async()=>{for(const value of ['null','{',JSON.stringify({...journal('committed'),version:99}),JSON.stringify({...journal('committed'),previous:{}})]){const s=fixture(rifornio);s.localStorage['rifornio-before-import-v1']=value;await assert.rejects(()=>createBackup(rifornio,s))}});
test('journal changes during capture invalidate the whole backup',async()=>{const s=fixture(rifornio);let n=0;await assert.rejects(()=>capture(rifornio,{getItem(k){return k==='rifornio-before-import-v1'?JSON.stringify({...journal('committed'),createdAt:String(n++)}):s.localStorage[k]??null}}),/SOURCE_CHANGED/)});
