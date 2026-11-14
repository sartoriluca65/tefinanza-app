(function(root){'use strict';
const Money=root.TFAccounting||(typeof require==='function'?require('./accounting.js'):null);
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),round=Money.round,quantityPrecision=n=>Number(n.toPrecision(12));
const aliases=[[/\b(?:inter)?spar\b/i,'Interspar'],[/\bfamila\b/i,'Famila'],[/\btosano\b/i,'Tosano'],[/\brossetto\b/i,'Rossetto'],[/\bamazon\b|\bamzn\b/i,'Amazon'],[/\bseconda strada\b/i,'Seconda Strada'],[/\btigota\b/i,'Tigotà'],[/\btamoil\b/i,'Tamoil'],[/\bcostantin\b/i,'Costantin'],[/\baveva\b(?=.*contributi)/i,'AVEPA'],[/\bpaypal\b/i,'PayPal'],[/\bavepa\b/i,'AVEPA'],[/\bfuel\s*cell\b/i,'Fuelcell Energy'],[/\blidl\b/i,'Lidl'],[/\bipertosano?\b/i,'Ipertosano'],[/\bprix\b/i,'Prix'],[/\baldi\b/i,'Aldi'],[/\beurospin\b/i,'Eurospin'],[/\besselunga\b/i,'Esselunga'],[/\bconad\b/i,'Conad'],[/\bcarrefour\b/i,'Carrefour'],[/\bcoop\b/i,'Coop'],[/\btelepass\b/i,'Telepass'],[/\bamerican express\b|\bamex\b/i,'American Express'],[/\bacquevenete\b|acqueve\b/i,'Acquevenete'],[/\battiva\b/i,'Attiva'],[/\benel\b/i,'Enel'],[/\bplenitude\b/i,'Plenitude'],[/\bjysk\b/i,'Jysk'],[/\bleroy merlin\b/i,'Leroy Merlin'],[/\bpacklink\b|\bauctane\b/i,'Packlink'],[/\bscalapay\b/i,'Scalapay']];
function clean(value,kind='description'){
 let s=String(value||'').replace(/null$/i,'').trim().replace(/\s+/g,' ');if(!s)return '';
 if(kind==='document')return s;
 let action='';
 if(kind==='description'){if(/\b(buy trade|acquist[oi]|compravendita titoli)\b/i.test(s))action='Acquisto ';else if(/\b(sell trade|vendit[ae]|cessione)\b/i.test(s))action='Vendita ';else if(/\bacconto\b/i.test(s))action='Acconto ';}
 for(const [pattern,label] of aliases)if(pattern.test(s))return (kind==='description'?action:'')+label;
 s=s.replace(/^(?:Pagamento (?:Express Checkout|preautorizzato utenza|su sito web|da cellulare)|Rimborso di pagamento|Beneficiario)\s*:\s*/i,'').replace(/^[·\s]+/,'').replace(/\b(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/gi,' ').replace(/[,\s]*(?:CN)?¥/g,' ').replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,' ').replace(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/g,' ')
  .replace(/\b(?:carta\s*(?:n\.?|numero)?|data\s*(?:operazione|ordine)|qta\s*\/\s*val[.]?nom[.]?|quantity|quantita|exchange rate|ecb rate|mand(?:ato)?|codice cliente|pod|pdr|iban|riferimento|rif[.]?|fattur[ae]|fatt[.]?|invoice|document[oi])\b.*$/i,' ')
  .replace(/\b(?:pagamento visa debit|pagamento pos|transazione con carta|addebito sdd|incoming transfer from|outgoing transfer to|buy trade|sell trade|compravendita titoli)\b/gi,' ')
  .replace(/\b(?:s[.]?r[.]?l[.]?|s[.]?p[.]?a[.]?|s[.]?n[.]?c[.]?)\b/gi,' ')
  .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g,' ').replace(/\b(?:19|20)\d{2}\b/g,' ')
  .replace(/\b\d+(?:[.,]\d+)*\b/g,' ').replace(/\b[a-z]*\d[a-z\d]{5,}\b/gi,' ')
  .replace(/\*+/g,' ').replace(/\s+[—–|-]\s*$/,'').replace(/\s+/g,' ').replace(/^[\s.,;:/-]+|[\s.,;:/-]+$/g,'').trim();
 if(!/[a-zÀ-ž]/i.test(s))return '';
 // A short manually entered name is already a useful label.
 return s.length>100?s.slice(0,100).replace(/\s+\S*$/,''):s;
}
function unique(values,kind='description'){
 const map=new Map();for(const value of values){const label=clean(value,kind),k=key(label);if(k&&!map.has(k))map.set(k,label)}
 return [...map.values()].sort((a,b)=>a.localeCompare(b,'it',{sensitivity:'base',numeric:true}));
}
function securities(s){
 const rows=[...(s.positions||[]).map(p=>({value:p.symbol,label:clean(p.name||p.symbol,'merchant')})),...(s.movements||[]).filter(m=>m.security).map(m=>({value:m.security,label:clean(m.security,'merchant')||m.security}))];
 const names=new Map();for(const row of rows){const label=key(row.label);if(label&&/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(row.value)){if(!names.has(label))names.set(label,new Set());names.get(label).add(row.value)}}
 const out=new Map();for(const row of rows){const known=names.get(key(row.label)),value=known?.size===1?[...known][0]:row.value;if(!out.has(value))out.set(value,{value,label:row.label})}
 return [...out.values()].sort((a,b)=>a.label.localeCompare(b.label,'it',{sensitivity:'base'}));
}
const defaultDescriptions=[
 // Alimentari e ristorazione: il motivo della spesa, non il nome dell'esercente.
 'Spesa alimentare','Pane e prodotti da forno','Frutta e verdura','Carne e pesce',
 'Colazione','Pranzo al ristorante','Cena al ristorante','Pizza','Pasto da asporto','Consegna pasti a domicilio',
 // Salute.
 'Visita medica','Visita specialistica','Visita oculistica','Visita dermatologica','Visita cardiologica',
 'Dentista','Igiene dentale','Esami di laboratorio','Analisi del sangue','Esame delle urine',
 'Ecografia','Radiografia','Risonanza magnetica','TAC','Ticket sanitario','Farmaci','Vaccinazione',
 'Fisioterapia','Riabilitazione','Occhiali e lenti a contatto','Dispositivi medici','Assicurazione sanitaria',
 // Auto e trasporti.
 'Carburante','Assicurazione auto','Riparazione auto','Manutenzione auto','Tagliando auto','Revisione auto',
 'Bollo auto','Pneumatici','Lavaggio auto','Pedaggio autostradale','Parcheggio',
 'Biglietto autobus','Biglietto treno','Abbonamento trasporti','Taxi','Noleggio auto',
 // Bollette e casa.
 'Energia elettrica','Gas metano','Acqua','Rifiuti (TARI)','Telefonia fissa','Telefonia mobile',
 'Ricarica telefonica','Connessione internet','Affitto','Rata mutuo','Spese condominiali','Assicurazione casa',
 'Riparazione domestica','Manutenzione caldaia','Intervento idraulico','Intervento elettrico','Pulizia casa',
 'Acquisto mobili','Acquisto elettrodomestici','Acquisto prodotti per la casa','Acquisto per la casa',
 // Abbigliamento, famiglia e animali.
 'Acquisto abbigliamento','Acquisto scarpe','Sartoria e riparazioni','Lavanderia','Parrucchiere','Cura della persona',
 'Retta scolastica','Mensa scolastica','Libri scolastici','Materiale scolastico','Corso di formazione',
 'Attività sportiva','Abbonamento palestra','Visita veterinaria','Farmaci veterinari','Alimenti per animali',
 // Viaggi, tempo libero e abbonamenti.
 'Biglietto aereo','Pernottamento','Pacchetto vacanza','Tassa di soggiorno','Ingresso museo',
 'Biglietto cinema','Biglietto teatro','Biglietto concerto','Acquisto libri','Abbonamento streaming',
 'Abbonamento software','Abbonamento giornale','Abbonamento','Acquisto online','Regalo','Donazione',
 // Tasse, multe e reddito.
 'Imposte e tasse','IRPEF','IMU','Imposta di bollo','Contributi previdenziali','Sanzione stradale',
 'Stipendio','Pensione','Tredicesima','Compenso professionale','Rimborso spese','Rimborso fiscale',
 'Rimborso acquisto','Rimborso','Canone di locazione incassato',
 // Banca e investimenti.
 'Bonifico','Giroconto','Prelievo contanti','Versamento contanti','Commissioni bancarie','Canone conto corrente',
 'Canone carta','Interessi passivi','Interessi attivi','Acquisto titoli','Vendita titoli','Dividendi','Interessi'
];
// Suggestion labels must not turn a reason such as "Acquisto Amazon" into a shop name.
function labels(values){const map=new Map();for(const value of values){const label=String(value||'').trim().replace(/\s+/g,' '),k=key(label);if(k&&!map.has(k))map.set(k,label)}return [...map.values()].sort((a,b)=>a.localeCompare(b,'it',{sensitivity:'base',numeric:true}))}
function separateChoices(s,saved){
 const merchants=[...(saved.merchants||[])],descriptions=[];
 const known=new Set([...(saved.merchants||[]),...(saved.providers||[]),...(s.movements||[]).map(m=>m.merchant),...(s.utilities||[]).map(u=>u.provider),...(s.bills||[]).map(b=>b.provider)].filter(Boolean).map(key));
 for(const value of saved.descriptions||[]){
  const label=String(value||'').trim(),normalized=key(label);
  // Only positively identified names move automatically; free-form reasons remain intact.
  const reason=/^(?:acquist[oi]|vendit[ae]|spes[ae]|pagamento|acconto|addebito|accredito|regalo|donazione|rimborso|bolletta|bonifico|rata|ricarica|canone|abbonamento|contribut[oi]|stipendio|pensione|giroconto|prelievo|versamento|interessi|dividendi)\b/i.test(label);
  const alias=aliases.some(([,name])=>normalized===key(name))||['spar','amzn','amex','ipertosano','acqueve'].includes(normalized);
  const business=/^(?:farmacia|supermercato|ipermercato|ristorante|pizzeria|trattoria|bar|negozio|ferramenta|panificio|distributore)\s+\S/i.test(label)||/\b(?:s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?)$/i.test(label);
  if(!reason&&(known.has(normalized)||alias||business))merchants.push(label);else descriptions.push(label);
 }
 return {...saved,descriptions:labels([...descriptions,...(saved.reasonCatalogVersion>=1?[]:defaultDescriptions)]),merchants:unique(merchants,'merchant'),providers:unique(saved.providers||[],'merchant'),reasonCatalogVersion:1};
}
function choices(s){
 const saved=separateChoices(s,s.savedChoices||{});
 return {
  descriptions:saved.descriptions,
  merchants:saved.merchants,
  providers:saved.providers,
  documents:unique([...(s.movements||[]).flatMap(m=>[m.documentNo,m.invoiceNo,m.paymentRef]),...(s.documents||[]).flatMap(d=>[d.documentNo,d.invoiceNo,d.reference,d.number])],'document')
 };
}
function remember(s){
 // Seed once; deleted suggestions must never be reconstructed from historical records.
 const saved=s.savedChoices||{
  descriptions:labels((s.movements||[]).map(m=>m.description)),
  merchants:unique((s.movements||[]).map(m=>m.merchant),'merchant'),
  providers:unique([...(s.utilities||[]).map(u=>u.provider),...(s.bills||[]).map(b=>b.provider)],'merchant')
 };
 s.savedChoices=separateChoices(s,saved);
 return s;
}
function trade({qty,unitPrice,total,commission=0,side='buy',changed='total',amountBasis='gross'}){try{if(!['buy','sell'].includes(side))return null;
 qty=Number(qty);unitPrice=Number(unitPrice);total=Number(total);commission=commission===''?0:Number(commission);if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(commission)||commission<0)return null;
 if(changed==='unitPrice'){if(!Number.isFinite(unitPrice)||unitPrice<0)return null;total=Money.multiply(qty,unitPrice)}
 else{if(!Number.isFinite(total))return null;total=Math.abs(total);if(amountBasis==='net'){total=Money.exactSum([total,side==='sell'?commission:-commission]);if(total<0)return null}unitPrice=total/qty}
 if(side==='sell'&&commission>total)return null;try{Money.cents(total);Money.cents(commission)}catch{return null}const amount=side==='sell'?total:-total;return {qty,unitPrice,total,commission,amount,netAmount:side==='sell'?Money.exactSum([total,-commission]):-Money.exactSum([total,commission]),effectiveUnitPrice:side==='sell'?(total-commission)/qty:(total+commission)/qty};
}catch{return null}}
function tradePositionAccount(s,m){
 const accounts=s.accounts||[],source=accounts.find(a=>a.name===m.account);if(!source)return null;
 if(m.relatedAccountId&&m.relatedAccountId!=='auto'&&m.relatedAccountId!=='none'){const selected=accounts.find(a=>a.id===m.relatedAccountId);return selected&&!selected.closed&&['Titoli','Cripto'].includes(selected.kind)?selected:null}
 if(['Titoli','Cripto'].includes(source.kind))return source.closed?null:source;
 if(m.relatedAccountId==='none')return null;
 const matches=accounts.filter(a=>!a.closed&&['Titoli','Cripto'].includes(a.kind)&&key(a.bank)===key(source.bank));return matches.length===1?matches[0]:null;
}
function settleTrade(s,m,cashName){
 const source=s.accounts.find(a=>a.name===m.account),cash=s.accounts.find(a=>a.name===cashName);
 if(!cash||cash.closed||cash.kind!=='Conto corrente')throw Error('Seleziona il conto corrente su cui regolare acquisto o vendita.');
 const portfolio=tradePositionAccount(s,m);
 return {...m,account:cash.name,...(portfolio?{relatedAccountId:portfolio.id}:{})};
}
function tradePosition(s,m,previous=null){
 if(m?.positionApplied&&!previous)return{ok:true,applied:false,account:m.positionAccount};
 if(!m.securityQty||m.securityUnitPrice===undefined||m.securityUnitPrice==='')return{ok:true,applied:false};
 const account=tradePositionAccount(s,m);if(!account)return{ok:false,message:'Per aggiornare automaticamente il dossier, seleziona il conto titoli collegato oppure verifica che esista un solo dossier per questa banca.'};
 const identified=s.positions.find(p=>p.account===account.name&&key(p.symbol)===key(m.security))||s.positions.find(p=>p.account===account.name&&key(p.name)===key(m.security)),canonicalSymbol=identified?.symbol||m.security;
 const chronology=s.movements.filter(row=>row.id!==previous?.id&&row.positionApplied&&row.positionAccount===account.name&&key(row.positionBefore?.symbol||row.positionSymbol)===key(canonicalSymbol));if(chronology.some(row=>String(row.date||'')>String(m.date||'')))return{ok:false,message:'Questa operazione ha una data precedente a una compravendita già applicata sullo stesso titolo. Per non alterare la quantità, registra prima il movimento mancante oppure correggi la posizione manualmente.'};
 if(previous?.positionApplied){const undo=undoTradePosition(s,previous);if(!undo.ok)return undo}
 const qty=Number(m.securityQty),unit=Number(m.securityUnitPrice),fee=Number(m.tradeCommission||0),side=m.tradeSide|| (Number(m.amount)>0?'sell':'buy');
 if(!m.security||!Number.isFinite(qty)||qty<=0||!Number.isFinite(unit)||unit<0||!Number.isFinite(fee)||fee<0)return{ok:false,message:'Completa titolo, quantità, prezzo e commissione prima di aggiornare la posizione.'};
 const exact=s.positions.find(p=>p.account===account.name&&key(p.symbol)===key(m.security)),named=s.positions.filter(p=>p.account===account.name&&key(p.name)===key(m.security));
 if(!exact&&named.length>1)return{ok:false,message:'Ci sono più posizioni con questo nome: scegli l’ISIN o il simbolo preciso.'};
 let position=exact||named[0]||null;
 const before=position?structuredClone(position):null;
 delete m.realizedPnL;delete m.positionUnitCost;
 if(side==='buy'){
  const oldQty=Number(position?.qty)||0,oldCost=Number(position?.cost)||0,known=oldQty===0||position?.costKnown!==false;
  const tradeCost=Money.exactSum([Math.abs(m.amount),fee]),newQty=Money.add(oldQty,qty),oldBook=oldQty===0?0:position?.bookCost??Money.multiply(oldQty,oldCost);
  if(!position){position={id:crypto.randomUUID(),account:account.name,symbol:m.security,name:m.security,qty:0,cost:0,price:unit,asOf:m.date,costKnown:true};s.positions.push(position)}
  position.qty=newQty;if(known){position.bookCost=Money.exactSum([oldBook,tradeCost]);position.cost=position.bookCost/newQty;position.costKnown=true}else{delete position.bookCost;position.costKnown=false;}position.name=position.name||m.security;if(oldQty===0){const C=root.TF||(typeof require==='function'?require('./core.js'):null);C.executionReference(position,m)}
 }else if(side==='sell'){
  if(!position)return{ok:false,message:'Titolo non trovato nel dossier '+account.name+'. Seleziona il simbolo o ISIN della posizione già presente in Investimenti.'};
  if(Money.compare(position.qty,qty)<0)return{ok:false,message:'Nel dossier '+account.name+' risultano '+position.qty+' titoli '+position.symbol+', ma stai vendendo '+qty+'. Verifica se la vendita è già registrata e modifica quella esistente, senza crearne una seconda.'};
  m.positionUnitCost=Number(position.cost);if(position.costKnown!==false){const book=position.bookCost??Money.multiply(position.qty,position.cost),removed=Money.compare(qty,position.qty)===0?book:Money.allocate(book,qty,position.qty);m.positionCostRemoved=removed;m.realizedPnL=Money.exactSum([Math.abs(m.amount),-fee,-removed]);position.bookCost=Money.exactSum([book,-removed]);}
  position.qty=Money.sub(position.qty,qty);if(position.qty===0&&position.costKnown!==false){position.cost=0;position.bookCost=0;}
 }else return{ok:false,message:'Seleziona Acquisto o Vendita per aggiornare la posizione.'};
 const latest= Math.max(0,...s.movements.filter(row=>row.id!==m.id&&row.positionApplied&&row.positionAccount===account.name&&key(row.positionBefore?.symbol||row.positionSymbol)===key(canonicalSymbol)).map(row=>Date.parse(row.positionAppliedAt)||0));
 m.positionApplied=true;m.positionAccount=account.name;m.positionSymbol=position.symbol;m.positionBefore=before;m.positionSide=side;m.positionAppliedAt=new Date(Math.max(Date.now(),latest+1)).toISOString();
 return{ok:true,applied:true,account:account.name};
}
function undoTradePosition(s,m){
 if(!m?.positionApplied)return{ok:true,applied:false};
 const later=s.movements.some(row=>row.id!==m.id&&row.positionApplied&&row.positionAccount===m.positionAccount&&key(row.positionBefore?.symbol||row.positionSymbol)===key(m.positionBefore?.symbol||m.positionSymbol)&&String(row.positionAppliedAt||'')>String(m.positionAppliedAt||''));
 if(later)return{ok:false,message:'Questa compravendita ha operazioni successive sullo stesso titolo. Per sicurezza non modifico la posizione: registra una compravendita correttiva oppure intervieni in ordine cronologico.'};
 const index=s.positions.findIndex(p=>p.account===m.positionAccount&&key(p.symbol)===key(m.positionBefore?.symbol||m.positionSymbol));
 if(m.positionBefore){const current=index>=0?s.positions[index]:null,restore={...structuredClone(m.positionBefore)};if(current&&current.executionPriceFor!==m.id){for(const field of ['price','asOf','priceSource','executionPriceFor','quoteProvider','quoteSymbol','quoteCurrency','quoteUpdatedAt','lastQuoteError'])if(current[field]!==undefined)restore[field]=current[field]}if(index>=0)s.positions[index]=restore;else s.positions.push(restore)}else if(index>=0)s.positions.splice(index,1);
 return{ok:true,applied:true};
}
function importMovements(s,rows){
 const C=root.TF||(typeof require==='function'?require('./core.js'):null),next=structuredClone(s),incoming=structuredClone(rows);
 for(const row of incoming){
  if(!next.accounts.some(a=>a.name===row.account&&!a.closed))throw Error('Conto di importazione inesistente o chiuso');
  let calculation=null;
  if(row.type==='Investimento'){
   if(!row.securityQty||!row.security||row.securityUnitPrice===undefined||row.tradeCommission===undefined||row.tradeCommission==='')throw Error('Importazione investimento incompleta: servono titolo, quantità, prezzo e commissione');
   const side=row.tradeSide||(row.amount>0?'sell':'buy');calculation=trade({qty:row.securityQty,unitPrice:row.securityUnitPrice,total:Math.abs(row.amount),commission:row.tradeCommission||0,side,amountBasis:row.tradeAmountBasis||'gross'});
   if(!calculation||Money.multiply(row.securityQty,row.securityUnitPrice)!==calculation.total)throw Error('Prezzo, quantità e controvalore della compravendita non quadrano');
   row.tradeSide=side;row.tradeCommission=calculation.commission;row.amount=calculation.amount;row.securityUnitPrice=calculation.unitPrice;
   const source=next.accounts.find(a=>a.name===row.account),candidates=next.accounts.filter(a=>a.kind==='Conto corrente'&&!a.closed&&key(a.bank)===key(source.bank)),cash=row.cashAccount||(source.kind==='Conto corrente'?source.name:candidates.length===1?candidates[0].name:'');
   Object.assign(row,settleTrade(next,row,cash));row.commissionAccount=row.commissionAccount||row.account;
  }
  delete row.cashAccount;delete row.tradeAmountBasis;
  const existing=next.movements.find(m=>m.id===row.id);
  if(existing){const keys=['date','account','amount','type','category','description','security','securityQty','securityUnitPrice','tradeCommission','commissionAccount','tradeSide','relatedAccountId','transferId','transferFee','commissionFor','refundFor','transferFeeFor'];if(keys.some(k=>row[k]!==undefined&&String(row[k]??'')!==String(existing[k]??'')))throw Error('Stesso identificativo con dati diversi: importazione annullata');continue;}
  if(calculation){const applied=tradePosition(next,row);if(!applied.ok)throw Error(applied.message);if(calculation.commission&&!incoming.some(m=>m.commissionFor===row.id))incoming.push({id:crypto.randomUUID(),date:row.date,account:row.commissionAccount,amount:-calculation.commission,type:'Spesa',category:'Spese bancarie',description:'Commissione bancaria',commissionFor:row.id,items:[]})}
  next.movements.push(row);
 }
 C.validate(next);C.validateAccountingChanges(s,next);return next;
}
// Un addebito totale e una contropartita per ogni conto di destinazione.
function allocatedTransfer(s,{id,from,date,amount,description,allocations},C){
 Money.cents(amount);
 if(!(amount>0)||!C.validDate(date)||!String(description||'').trim()||!Array.isArray(allocations)||!allocations.length)throw Error('Completa data, causale, totale e quote del giroconto.');
 const destinations=new Set();
 for(const part of allocations){Money.cents(part.amount);if(!(part.amount>0)||part.account===from||destinations.has(part.account))throw Error('Scegli conti di arrivo diversi tra loro e dal conto di partenza, con quote positive.');destinations.add(part.account);}
 if(![from,...destinations].every(name=>s.accounts.some(a=>a.name===name&&!a.closed)))throw Error('Scegli soltanto conti aperti per il giroconto.');
 if(Money.exactSum(allocations.map(p=>p.amount))!==amount)throw Error('La somma delle quote deve coincidere con il totale del giroconto.');
 const group=id||C.uid(),previous=s.movements.filter(m=>m.transferId===group),oldOut=previous.find(m=>m.amount<0),oldFee=s.movements.find(m=>m.transferFeeFor===group),fee=Math.abs(oldFee?.amount||0);
 if(previous.some(m=>m.incomeTransferFor))throw Error('Modifica il trasferimento dalla sua entrata di origine.');
 return C.transact(s,next=>{
  next.movements=next.movements.filter(m=>m.transferId!==group&&m.transferFeeFor!==group);
  const base={date,description,type:'Giroconto',category:'Altro',transferId:group,transferAllocated:true,transferFee:fee,merchant:'',security:'',items:[],demo:false};
  next.movements.push({...base,id:oldOut?.id||C.uid(),account:from,amount:-amount},...allocations.map(part=>({...base,id:previous.find(m=>m.amount>0&&m.account===part.account)?.id||C.uid(),account:part.account,amount:part.amount})));
  if(oldFee)next.movements.push({...oldFee,date,account:from});
 });
}
// Mantiene il bonifico e le due contropartite in un unico salvataggio atomico.
function incomeTransfer(s,m,C){
 const previous=s.movements.filter(row=>row.incomeTransferFor===m.id),transferId=previous[0]?.transferId||C.uid();
 const base={...s,movements:s.movements.filter(row=>row.incomeTransferFor!==m.id)};
 if(!m.incomeTransferTo)return base.movements;
 if(m.type!=='Entrata'||m.splitGroupId||!(m.amount>0))throw Error('Il giroconto immediato richiede un’entrata positiva senza ripartizione in quote.');
 const updated=C.transfer(base,{id:transferId,from:m.account,to:m.incomeTransferTo,date:m.date,amount:m.amount,description:'Giroconto da entrata: '+m.description});
 return updated.movements.map(row=>row.transferId===transferId?{...row,id:previous.find(old=>Math.sign(old.amount)===Math.sign(row.amount))?.id||row.id,incomeTransferFor:m.id}:row);
}
function setClosed(s,id,closed,date){const a=s.accounts.find(a=>a.id===id);if(!a)throw Error('Conto non trovato');a.closed=!!closed;if(closed)a.closedAt=date;else delete a.closedAt;return s}
const api={allocatedTransfer,incomeTransfer,key,clean,unique,choices,securities,remember,trade,importMovements,settleTrade,tradePosition,undoTradePosition,setClosed};root.TFWorkflow=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
