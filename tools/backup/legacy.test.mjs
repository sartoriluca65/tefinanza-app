import test from 'node:test';
import assert from 'node:assert/strict';
import {importLegacyJSON} from './legacy.mjs';
import {verifyBackup} from './backup.mjs';
import {diviso,rifornio,cochiPrivate,tefinanza} from './profiles.mjs';
test('old Diviso JSON remains byte-identical including whitespace',async()=>{
 const text=' {"people":[],"expenses":[]} ';const {backup}=await importLegacyJSON(diviso,text);assert.equal((await verifyBackup(diviso,backup)).localStorage['diviso-v2'],text);
});
test('old Rifornio JSON is accepted with an explicit partial historical scope',async()=>{
 const {backup,scope}=await importLegacyJSON(rifornio,JSON.stringify({app:'Rifornio',schemaVersion:1,vehicles:[],entries:[]}));
 assert.equal(scope,'LEGACY_VEHICLES_AND_REFUELS_ONLY');await verifyBackup(rifornio,backup);
});
test('old Cochi JSON accepted; protected copies are never decrypted implicitly',async()=>{
 const text=JSON.stringify({rows:[],historic:['Luca'],log:[]});await importLegacyJSON(cochiPrivate,text);
 await assert.rejects(importLegacyJSON(cochiPrivate,'{"format":"cochi-backup-encrypted"}'),/USE_EXISTING_LOCAL_DECRYPTION_TOOL/);
});
test('TeFinanza v3 originals survive native JSON conversion',async()=>{
 const raw={backupVersion:3,accounts:[],movements:[],positions:[],documents:[{id:'d'}],originalFiles:[{id:'d',name:'synthetic',data:'data:application/pdf;base64,AAEC'}]};
 const {backup}=await importLegacyJSON(tefinanza,JSON.stringify(raw));const s=await verifyBackup(tefinanza,backup);
 assert.deepEqual([...new Uint8Array(await s.databases[0].stores[1].entries[0].value.blob.arrayBuffer())],[0,1,2]);
 raw.originalFiles=[];await assert.rejects(importLegacyJSON(tefinanza,JSON.stringify(raw)),/MISSING_ATTACHMENT/);
});
