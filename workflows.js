(function(root){'use strict';
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
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
function choices(s){const saved=s.savedChoices||{};return {
 descriptions:unique([...(saved.descriptions||[]),...(s.movements||[]).map(m=>/compravendita titoli/i.test(m.description||'')?(m.amount>0?'Vendita ':'Acquisto ')+m.description.replace(/compravendita titoli/i,''):m.description)]),
 merchants:unique([...(saved.merchants||[]),...(s.movements||[]).map(m=>m.merchant),...(s.utilities||[]).map(u=>u.provider),...(s.bills||[]).map(b=>b.provider)],'merchant'),
 providers:unique([...(saved.providers||[]),...(s.utilities||[]).map(u=>u.provider),...(s.bills||[]).map(b=>b.provider)],'merchant'),
 documents:unique([...(s.movements||[]).flatMap(m=>[m.documentNo,m.invoiceNo,m.paymentRef]),...(s.documents||[]).flatMap(d=>[d.documentNo,d.invoiceNo,d.reference,d.number])],'document')
}}
function remember(s){const c=choices(s);s.savedChoices={descriptions:c.descriptions,merchants:c.merchants,providers:c.providers};return s}
function trade({qty,unitPrice,total,commission=0,side='buy',changed='total'}){
 qty=Number(qty);unitPrice=Number(unitPrice);total=Number(total);commission=commission===''?0:Number(commission);if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(commission)||commission<0)return null;
 if(changed==='unitPrice'){if(!Number.isFinite(unitPrice)||unitPrice<0)return null;total=Math.round((qty*unitPrice+Number.EPSILON)*100)/100}
 else{if(!Number.isFinite(total))return null;total=Math.abs(total);unitPrice=total/qty}
 if(side==='sell'&&commission>total)return null;const amount=side==='sell'?total:-total;return {qty,unitPrice,total,commission,amount,netAmount:side==='sell'?total-commission:-(total+commission),effectiveUnitPrice:side==='sell'?(total-commission)/qty:(total+commission)/qty};
}
function setClosed(s,id,closed,date){const a=s.accounts.find(a=>a.id===id);if(!a)throw Error('Conto non trovato');a.closed=!!closed;if(closed)a.closedAt=date;else delete a.closedAt;return s}
const api={key,clean,unique,choices,securities,remember,trade,setClosed};root.TFWorkflow=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
