const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../payments.js');
const date='2026-11-10';
test('OCR non scambia consumi annui con totale bimestrale',()=>{
 const b=C.parseBill('ENGIE Energia\nVettore energetico: energia elettrica\nConsumi annui 4.000,00 EUR\nTotale da pagare 78,45 EUR\nScadenza 25/11/2026',date);
 assert.equal(b.amount,78.45);assert.equal(b.type,'Energia elettrica');assert.equal(b.due,'2026-11-25');
});
test('OCR distingue gas naturale dal fornitore',()=>{
 const b=C.parseBill('ENGIE Energia\nVettore energetico: gas naturale\nTotale da pagare 92,15',date);
 assert.equal(b.type,'Gas metano');assert.equal(b.amount,92.15);
});
test('Genere di utenza personalizzato resta valido nel backup',()=>{
 let s=C.migrate({movements:[]});const a=s.accounts[0];s.utilities.push({id:'personalizzata',name:'Servizio condominiale',provider:'Fornitore prova',type:'Riscaldamento centralizzato',accountId:a.id,autoDebit:false,managedExternally:false});
 assert.doesNotThrow(()=>C.validate(s));assert.equal(C.migrate(JSON.parse(JSON.stringify(s))).utilities[0].type,'Riscaldamento centralizzato');
});
test('Promemoria con scadenza futura non genera una spesa o pagamento',()=>{
 let s=C.migrate({movements:[]});const a=s.accounts[0];s.utilities.push({id:'u',name:'Gas',provider:'Engie',type:'Gas metano',accountId:a.id,autoDebit:false,managedExternally:false});
 s=C.registerBill(s,{id:'b',utilityId:'u',provider:'Engie',invoiceNo:'nov26',issued:'2026-11-01',due:'2026-11-25',amount:92.15,accountId:a.id,scheduledForDue:true});
 assert.equal(s.movements.length,0);assert.equal(C.billStatus(s,s.bills[0],date).paid,false);
});
