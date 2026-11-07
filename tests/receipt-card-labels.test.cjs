const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../core.js');
test('I prodotti che iniziano con carta restano articoli, anche con quantità e sconto',()=>{
 for(const product of ['CARTA IGIENICA','Carta da cucina','CARTA FORNO','CARTA REGALO','CARTA A4']){
  const r=C.parseReceipt('MARKET\n19/10/2026\n'+product+' 4,50\n2 x 1,50\nLATTE 3,00\nSCONTO -0,50\nTOTALE 7,00\nCARTA DI CREDITO 7,00');
  assert.equal(r.items.length,3,product);assert.equal(r.items[0].name,product);
  assert.equal(r.items[1].qty,2);assert.equal(r.items.reduce((n,i)=>n+i.total,0),r.total);
 }
});
test('Le righe di pagamento carta non diventano prodotti e non raddoppiano il totale',()=>{
 for(const payment of ['CARTA','CARTA CREDITO','CARTA DI CREDITO','CARTA DEBITO','CARTA DI DEBITO','CARTA ELETTRONICA','CARTA BANCARIA','CARTA DI PAGAMENTO','CARTA VISA','CARTA MASTERCARD','CARTA MAESTRO','CARTA AMEX','CARTA AMERICAN EXPRESS','CARTA ****1234','PAGAMENTO CARTA','BANCOMAT','CONTANTI']){
  const r=C.parseReceipt('MARKET\n19/10/2026\nCARTA IGIENICA 4,50\nTOTALE 4,50\n'+payment+' 4,50');
  assert.equal(r.items.length,1,payment);assert.equal(r.items[0].category,'Casa');
  assert.equal(r.items[0].total,4.5);assert.equal(r.total,4.5);
 }
});
