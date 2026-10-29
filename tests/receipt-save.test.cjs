const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const C=require('../core.js');
test('Confermare uno scontrino salva documento e movimento senza variabili del modulo movimenti',async()=>{
  const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,{value:'',checked:false,classList:{},close(){}});return nodes.get(s)};
  const state={rules:{},documents:[],movements:[]};
  const context={C,state,docDraft:{text:'NEGOZIO DI PROVA\nLATTE 3,00\nTOTALE 3,00',account:'Conto di prova',kind:'Scontrino',method:'Test'},
    $:get,matchingExpenses:()=>[],esc:String,euro:String,today:()=> '2026-10-29',dateLabel:String,
    categoryInput:()=>'',itemInputs:()=>'',wireItems:()=>{},readItems:()=>[{name:'Latte',qty:1,total:3,category:'Alimentari'}],
    change:async fn=>{fn(state);return true},toast:()=>{}};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('function reviewReceipt(){'),source.indexOf('function reviewStatement(){')),context);
  context.reviewReceipt();
  for(const [id,value] of Object.entries({receiptTotal:'3',receiptDate:'2026-10-29',receiptMerchant:'Negozio di prova',receiptDescription:'Spesa',receiptLink:'new',receiptCategory:'Alimentari'}))get('#'+id).value=value;
  get('#receiptVerified').checked=true;
  await get('#confirmReceipt').onclick();
  assert.equal(state.documents.length,1);assert.equal(state.movements.length,1);
  assert.equal(state.movements[0].amount,-3);assert.equal(state.movements[0].docId,state.documents[0].id);
  assert.equal(state.rules['latte'],'Alimentari');
});
