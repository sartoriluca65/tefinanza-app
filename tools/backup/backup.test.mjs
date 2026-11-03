import test from 'node:test';
import assert from 'node:assert/strict';
import {capture,createBackup,verifyBackup,prepareRestore,restoreToNewSandbox,browserSandbox,encode,decode,sha256} from './backup.mjs';
import {diviso,rifornio,stickers,tefinanza,cochiPrivate,cochiPublic,clinical,autocontrol,credentialDemo} from './profiles.mjs';
const snapshot=(localStorage={},databases=[])=>({localStorage,databases});
const store=(name,entries)=>({name,entries});
const entry=(key,value)=>({key,value});
const blob=()=>new Blob([new Uint8Array([0,1,2,3,255])],{type:'application/octet-stream'});
const image='data:image/png;base64,AAEC';
const divisoState=()=>({people:[{id:'p1',name:'Synthetic'}],expenses:[{id:'e1',amount:'10.01',who:['p1'],title:'Synthetic'}],groups:[]});
function financial(){return {accounts:[{id:'a'}],movements:[],positions:[],documents:[{id:'d'}]};}
function clinicalState(){return {farmaci:[],assunzioni:[],eventi:[],documenti:[{fileKey:'synthetic-file',nome:'synthetic'}],controlli:[],esamiRoutine:[]};}
function autoState(){return Object.fromEntries(['vehicles','maintenance','fuel','parts','documents','insurance','tax','revision','bodywork','deadlines','accessories','workshops'].map(k=>[k,k==='documents'?[{id:'doc',files:[{id:'file'}]}]:[]]));}
const fixtures=[
  [diviso,snapshot({'diviso-v2':JSON.stringify(divisoState())})],
  [rifornio,snapshot({rifornioVehicles:'[{"id":"v","name":"Synthetic"}]',rifornioEntries:'[{"id":"e","vehicleId":"v","quantity":1,"price":2}]',pienosmartTripDraftV1:'{"synthetic":true}',pienosmartRecordedTrips:'[{"km":3}]'})],
  [stickers,snapshot({'ss-packs':'[{"id":"p","name":"Synthetic"}]','ss-stickers':'[{"id":"s","name":"Synthetic"}]'},[{name:'luki-stickers',stores:[store('stickers',[entry('s',{id:'s',image})])]}])],
  [tefinanza,snapshot({},[{name:'TeFinanza-family',stores:[store('state',[entry('current',financial())]),store('files',[entry('d',{id:'d',name:'synthetic',blob:blob()})])]}])],
  ...[cochiPrivate,cochiPublic].map(spec=>[spec,snapshot({[spec.stateKey]:JSON.stringify({rows:[{id:1,income:1001,expense:0}],historic:['Synthetic'],log:[]})})]),
  ...[clinical(),clinical('00000000-0000-0000-0000-000000000001')].map(spec=>[spec,snapshot({},[{name:spec.databases[0].name,stores:[store('cache',[entry('state',{data:clinicalState()})])]},{name:spec.databases[1].name,stores:[store('files',[entry('synthetic-file',{key:'synthetic-file',blob:blob()})])]}])]),
  [autocontrol(),snapshot({'autocontrol-v1':JSON.stringify(autoState())},[{name:'autocontrol-documents',stores:[store('scans',[entry('file',{id:'file',blob:blob()})])]}])],
  [credentialDemo,snapshot({'luca-sartori-ricorda-demo-protected-v2':JSON.stringify({version:2,pin:{salt:'synthetic',iv:'synthetic',box:'synthetic'},recovery:{salt:'synthetic',iv:'synthetic',box:'synthetic'},payload:{iv:'synthetic',box:'synthetic'}})})]
];
for(const [spec,data]of fixtures){
  test(spec.id+': complete round trip preserves all data and bytes',async()=>{
    const original=JSON.stringify(await encode(data)),b=await createBackup(spec,data),restored=await verifyBackup(spec,JSON.stringify(b));
    assert.equal(JSON.stringify(await encode(restored)),original);
    const target={name:'backup-preparation-test',exists:false,async insertNew(value){this.value=structuredClone(value);}};
    await restoreToNewSandbox(spec,b,target);assert.deepEqual(await encode(target.value.snapshot),await encode(data));
    assert.equal(JSON.stringify(await encode(data)),original);
  });
}
test('corrupted, truncated, wrong app and future versions rejected without writing',async()=>{
  const [spec,data]=fixtures[0],b=await createBackup(spec,data);let writes=0;
  const target={name:'backup-preparation-test',exists:false,async insertNew(){writes++;}};
  const damaged=structuredClone(b);damaged.payload.entries=[];
  for(const item of [damaged,JSON.stringify(b).slice(0,-10),{...b,app:'another'},{...b,version:2}])await assert.rejects(restoreToNewSandbox(spec,item,target));
  assert.equal(writes,0);
});
test('missing attachments rejected for each binary application',async()=>{
  for(const kind of ['stickers','tefinanza','clinical','autocontrol']){
    const [spec,data]=fixtures.find(([s])=>s.kind===kind),bad=structuredClone(data);
    bad.databases=[];await assert.rejects(createBackup(spec,bad));
  }
});
test('duplicate records and invalid references rejected',async()=>{
  const data=divisoState();data.people.push({...data.people[0]});await assert.rejects(createBackup(diviso,snapshot({'diviso-v2':JSON.stringify(data)})));
  data.people.pop();data.expenses[0].who=['missing'];await assert.rejects(createBackup(diviso,snapshot({'diviso-v2':JSON.stringify(data)})));
});
test('source is read-only, allowlisted and unchanged',async()=>{
  const data=fixtures[0][1],keys=[];
  const source={getItem(k){keys.push(k);return data.localStorage[k]??null;},async readDatabase(){throw Error('unexpected');},setItem(){throw Error('write forbidden');}};
  await capture(diviso,source);assert.deepEqual(keys,['diviso-v2','diviso-v2']);
});
test('source changes invalidate capture',async()=>{
  let n=0;const source={getItem(){const s=divisoState();s.people[0].name='Synthetic '+n++;return JSON.stringify(s);}};
  await assert.rejects(capture(diviso,source),/SOURCE_CHANGED/);
});
test('interruption before capture and restore leaves original untouched',async()=>{
  const c=new AbortController();c.abort();let reads=0,writes=0;
  await assert.rejects(capture(diviso,{getItem(){reads++;}},{signal:c.signal}),/INTERRUPTED/);
  const b=await createBackup(diviso,fixtures[0][1]);await assert.rejects(restoreToNewSandbox(diviso,b,{name:'backup-preparation-test',exists:false,async insertNew(){writes++;}},{signal:c.signal}),/INTERRUPTED/);
  assert.equal(reads,0);assert.equal(writes,0);
});
test('failed atomic target never replaces a valid archive',async()=>{
  const original=Object.freeze({synthetic:'valid'}),b=await createBackup(diviso,fixtures[0][1]);
  const target={name:'backup-preparation-test',exists:false,value:original,async insertNew(){throw Error('SIMULATED_QUOTA_OR_INTERRUPTION');}};
  await assert.rejects(restoreToNewSandbox(diviso,b,target));assert.equal(target.value,original);
});
test('existing and application storage targets rejected',async()=>{
  const b=await createBackup(diviso,fixtures[0][1]);let writes=0;
  for(const target of [{name:'backup-preparation-test',exists:true},{name:'TeFinanza-family',exists:false}])await assert.rejects(restoreToNewSandbox(diviso,b,{...target,async insertNew(){writes++;}}));
  assert.equal(writes,0);
  assert.throws(()=>browserSandbox({location:{hostname:'sartoriluca65.github.io'}}),/ISOLATED_ORIGIN_REQUIRED/);
});
test('credentials, unknown state records and unsupported handles excluded',async()=>{
  await assert.rejects(createBackup(diviso,snapshot({...fixtures[0][1].localStorage,'autocontrol-auth-v1':'not-a-real-token'})),/OUT_OF_SCOPE_KEY/);
  const bad=structuredClone(fixtures.find(([s])=>s===tefinanza)[1]);bad.databases[0].stores[0].entries.push(entry('localArchiveFolder',{synthetic:true}));await assert.rejects(createBackup(tefinanza,bad),/OUT_OF_SCOPE_RECORD/);
  await assert.rejects(encode(new Map()),/UNSUPPORTED_VALUE/);
});
test('prototype keys remain inert and binary encodings are strict',async()=>{
  const o=JSON.parse('{"__proto__":{"polluted":true}}');const d=decode(await encode(o));assert.equal({}.polluted,undefined);assert.equal(Object.getPrototypeOf(d),Object.prototype);
  assert.throws(()=>decode({type:'blob',mime:'x',data:'not base64'}),/INVALID_BASE64/);
});
test('legacy state is preserved exactly without automatic migration',async()=>{
  const original=' {"people":[{"id":"p"}],"expenses":[]} ',s=snapshot({'diviso-v2':original});
  const plan=await prepareRestore(diviso,await createBackup(diviso,s));assert.equal(plan.snapshot.localStorage['diviso-v2'],original);
});
test('tampering with recomputed hash cannot smuggle an incomplete snapshot',async()=>{
  const [spec,data]=fixtures.find(([s])=>s===tefinanza),b=await createBackup(spec,data),bad=structuredClone(data);bad.databases[0].stores[1].entries=[];
  b.payload=await encode(bad);b.sha256=await sha256(new TextEncoder().encode(JSON.stringify(b.payload)));
  await assert.rejects(verifyBackup(spec,b),/MISSING_ATTACHMENT/);
});
