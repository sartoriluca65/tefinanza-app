'use strict';
const QUOTE_SETTINGS_KEY='tefinanza-market-quotes-v1';
const QUOTE_PROVIDER='Alpha Vantage';
const quoteDefaults={'US35952H7008':{symbol:'FCEL',currency:'USD'}};
let quoteRefreshPromise=null;

function quoteSettings(){try{return JSON.parse(localStorage.getItem(QUOTE_SETTINGS_KEY)||'{}')}catch{return {}}}
function quoteToday(){return new Date().toLocaleDateString('sv-SE')}
function latestQuoteUpdate(settings=quoteSettings()){
 const stamps=[settings.lastSuccessAt,...(state?.positions||[]).map(p=>p.quoteUpdatedAt)].filter(Boolean).map(v=>new Date(v)).filter(d=>!Number.isNaN(d.getTime()));
 return stamps.length?new Date(Math.max(...stamps.map(d=>d.getTime()))):null;
}
function quoteStatusMessage(settings=quoteSettings()){
 const configured=!!settings.apiKey,latest=latestQuoteUpdate(settings),latestText=latest?`Ultimo aggiornamento riuscito: ${latest.toLocaleString('it-IT')}.`:'Nessun aggiornamento riuscito ancora.';
 let message=configured?latestText:'Aggiornamenti automatici non attivi: inserisci e salva una chiave API personale.';
 if(settings.lastError)message+=' Ultimo errore: '+settings.lastError;
 else if(configured&&settings.lastAttemptDate===quoteToday())message+=' Controllo di oggi completato.';
 else if(configured&&!latest)message+=' Al prossimo avvio verrà tentato il primo aggiornamento.';
 return message;
}
function renderQuoteControls(){
 const host=document.querySelector('#positionQuotes');if(!host||!ready)return;
 const settings=quoteSettings(),configured=!!settings.apiKey;
 host.innerHTML=`<div class="notice"><h3>Valore automatico delle posizioni</h3><p>Le quotazioni giornaliere sono fornite da ${QUOTE_PROVIDER}. Una volta salvata la chiave personale in questo browser, l’app aggiorna automaticamente le quotazioni mancanti o non aggiornate quando la apri, al massimo una volta al giorno. Per ogni titolo imposta simbolo e valuta nella scheda della posizione. La chiave resta in questo browser e non entra nella copia dei dati; ogni dispositivo necessita della propria chiave. Simboli e richieste vengono inviati ad Alpha Vantage.</p><label>Chiave API ${configured?'<span class="small">(già salvata in questo browser)</span>':''}<input id="quoteApiKey" type="password" autocomplete="off" placeholder="Inserisci la chiave API" value=""></label><div class="toolbar"><button class="btn primary" id="saveQuoteKey">Salva chiave</button><button class="btn" id="refreshQuotes" ${configured?'':'disabled'}>Aggiorna quotazioni</button>${configured?'<button class="btn" id="forgetQuoteKey">Rimuovi chiave</button>':''}</div><p id="quoteStatus" class="small" role="status" aria-live="polite"></p></div>`;
 const status=document.querySelector('#quoteStatus');if(status)status.textContent=quoteStatusMessage(settings);
 document.querySelector('#saveQuoteKey').onclick=()=>{const apiKey=document.querySelector('#quoteApiKey').value.trim();if(!apiKey)return toast('Inserisci una chiave API.');localStorage.setItem(QUOTE_SETTINGS_KEY,JSON.stringify({...quoteSettings(),apiKey,lastError:'',lastErrorAt:''}));renderQuoteControls();refreshQuotes(false,{force:true})};
 const refresh=document.querySelector('#refreshQuotes');if(refresh)refresh.onclick=()=>refreshQuotes(true,{force:true});
 const forget=document.querySelector('#forgetQuoteKey');if(forget)forget.onclick=()=>{localStorage.removeItem(QUOTE_SETTINGS_KEY);renderQuoteControls()};
}
async function quoteFetch(symbol,apiKey){
 const url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function','GLOBAL_QUOTE');url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',apiKey);
 const response=await fetch(url);if(!response.ok)throw Error('Il fornitore non risponde ('+response.status+').');
 const data=await response.json();if(data.Note||data.Information||data['Error Message'])throw Error(data.Note||data.Information||data['Error Message']);
 const quote=data['Global Quote'],price=Number(quote?.['05. price']),date=quote?.['07. latest trading day'];if(!(price>0))throw Error('Quotazione non disponibile per '+symbol+'.');return{price,date};
}
async function quoteFx(currency,apiKey,cache){
 if(cache.has(currency))return cache.get(currency);
 const url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function','CURRENCY_EXCHANGE_RATE');url.searchParams.set('from_currency',currency);url.searchParams.set('to_currency','EUR');url.searchParams.set('apikey',apiKey);
 const response=await fetch(url);if(!response.ok)throw Error('Cambio '+currency+'/EUR non disponibile ('+response.status+').');
 const data=await response.json();if(data.Note||data.Information||data['Error Message'])throw Error(data.Note||data.Information||data['Error Message']);
 const rate=Number(data['Realtime Currency Exchange Rate']?.['5. Exchange Rate']);if(!(rate>0))throw Error('Cambio '+currency+'/EUR non disponibile.');cache.set(currency,rate);return rate;
}
async function refreshQuotes(userInitiated=false,options={}){
 if(quoteRefreshPromise)return quoteRefreshPromise;
 const settings=quoteSettings(),status=document.querySelector('#quoteStatus');
 if(!settings.apiKey){if(status)status.textContent=quoteStatusMessage(settings);if(userInitiated)toast('Prima salva una chiave API del fornitore.');return}
 const positions=state.positions.filter(p=>Number(p.qty)>0);
 if(!positions.length){if(status)status.textContent='Non ci sono posizioni con quantità maggiore di zero.';return}
 const today=quoteToday();
 if(options.automatic&&settings.lastAttemptDate===today){if(status)status.textContent=quoteStatusMessage(settings);return}
 const attemptAt=new Date().toISOString();
 localStorage.setItem(QUOTE_SETTINGS_KEY,JSON.stringify({...settings,lastAttemptDate:today,lastAttemptAt:attemptAt}));
 if(status)status.textContent='Aggiornamento delle quotazioni…';
 quoteRefreshPromise=(async()=>{
  const updates=new Map(),errors=[],quotes=new Map(),fxRates=new Map(),apiKey=settings.apiKey;
  for(const position of positions){
   const mapping=quoteDefaults[position.symbol]||{},symbol=(position.quoteSymbol||mapping.symbol||'').trim(),currency=(position.quoteCurrency||mapping.currency||'EUR').toUpperCase();
   if(!symbol){errors.push(position.name+': simbolo di quotazione da impostare');continue}
   const key=symbol+'|'+currency;
   try{
    let quote=quotes.get(key);
    if(!quote){const q=await quoteFetch(symbol,apiKey);let price=q.price;if(currency!=='EUR')price*=await quoteFx(currency,apiKey,fxRates);quote={price,date:q.date};quotes.set(key,quote)}
    updates.set(position.id,{price:quote.price,asOf:quote.date||today,quoteProvider:QUOTE_PROVIDER,quoteUpdatedAt:new Date().toISOString()});
   }catch(error){let message=String(error?.message||error).replaceAll(apiKey,'[chiave nascosta]').slice(0,320);errors.push(position.name+': '+message)}
  }
  if(updates.size){const saved=await change(s=>{for(const[id,quote]of updates){const target=s.positions.find(x=>x.id===id);if(target)Object.assign(target,quote)}});if(!saved){errors.push('I prezzi non sono stati salvati nell’archivio.');updates.clear()}}
  const finishedAt=new Date().toISOString(),latestSettings=quoteSettings();
  const next={...latestSettings,lastAttemptDate:today,lastAttemptAt:attemptAt};
  if(updates.size)next.lastSuccessAt=finishedAt;
  if(errors.length){next.lastError=errors.join(' · ');next.lastErrorAt=finishedAt}else{next.lastError='';next.lastErrorAt=''}
  localStorage.setItem(QUOTE_SETTINGS_KEY,JSON.stringify(next));
  renderQuoteControls();
  const result=updates.size+' posizione/i aggiornate'+(errors.length?'. Da controllare: '+errors.join(' · '):'.');
  const newStatus=document.querySelector('#quoteStatus');if(newStatus)newStatus.textContent=quoteStatusMessage(next)+(errors.length?' Verifica simbolo, connessione o limiti del fornitore.':'');
  if(userInitiated)toast(result);
  return{updated:updates.size,errors};
 })();
 try{return await quoteRefreshPromise}finally{quoteRefreshPromise=null}
}
function scheduleQuoteRefresh(){
 renderQuoteControls();const settings=quoteSettings();if(!settings.apiKey)return;
 const positions=state.positions.filter(p=>Number(p.qty)>0);if(!positions.length)return;
 const today=quoteToday(),stale=positions.some(p=>!p.quoteUpdatedAt||new Date(p.quoteUpdatedAt).toLocaleDateString('sv-SE')!==today);
 if(!stale||settings.lastAttemptDate===today)return;
 setTimeout(()=>refreshQuotes(false,{automatic:true}),1200);
}
window.addEventListener('tefinanza-ready',scheduleQuoteRefresh);
