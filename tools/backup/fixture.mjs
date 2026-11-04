export function fixture(spec){
 const s={localStorage:{},databases:[]},db=(name,stores)=>({name,stores}),st=(name,entries)=>({name,entries}),en=(key,value)=>({key,value});
 if(spec.kind==='diviso')s.localStorage['diviso-v2']=JSON.stringify({people:[{id:'synthetic-person',name:'Synthetic'}],expenses:[],groups:[]});
 else if(spec.kind==='rifornio')Object.assign(s.localStorage,{rifornioVehicles:'[]',rifornioEntries:'[]',pienosmartTripDraftV1:'{}',pienosmartRecordedTrips:'[]'});
 else if(spec.kind==='cochi')s.localStorage[spec.stateKey]=JSON.stringify({rows:[],historic:['Luca'],cutoff:'2023-05-31',log:[]});
 else if(spec.kind==='stickers'){s.localStorage['ss-packs']='[]';s.localStorage['ss-stickers']='[]';s.databases=[db('luki-stickers',[st('stickers',[])])];}
 else if(spec.kind==='tefinanza')s.databases=[db('TeFinanza-family',[st('state',[en('current',{accounts:[],movements:[],positions:[],documents:[]})]),st('files',[])])];
 else if(spec.kind==='autocontrol')s.localStorage[spec.stateKey]=JSON.stringify(Object.fromEntries(['vehicles','maintenance','fuel','parts','documents','insurance','tax','revision','bodywork','deadlines','accessories','workshops'].map(k=>[k,[]])));
 else if(spec.kind==='clinical')s.databases=[db(spec.databases[0].name,[st('cache',[en('state',{data:{paziente:{nome:'Synthetic'},farmaci:[],assunzioni:[],eventi:[],documenti:[],controlli:[],esamiRoutine:[]}})])]),db(spec.databases[1].name,[st('files',[])])];
 else if(spec.kind==='vault')s.localStorage['luca-sartori-ricorda-demo-protected-v2']=JSON.stringify({version:2,pin:{salt:'synthetic',iv:'synthetic',box:'synthetic'},recovery:{salt:'synthetic',iv:'synthetic',box:'synthetic'},payload:{iv:'synthetic',box:'synthetic'}});
 return s;
}
