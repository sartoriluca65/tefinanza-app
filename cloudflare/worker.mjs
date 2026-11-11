// Staging only. All personal payloads are encrypted in the browser.
import {bootstrap,controller} from './assets.mjs';
const encoder = new TextEncoder();
export const LIMIT = 8 * 1024 * 1024;
export const HASH = /^[a-f0-9]{64}$/;
export const OP = /^[a-f0-9-]{36}$/;
export const INSERT_REVISION = `INSERT INTO revisions(user_id,revision,operation_id,object_key,payload_sha256)
 SELECT ?, ?, ?, ?, ? WHERE COALESCE((SELECT MAX(revision) FROM revisions WHERE user_id=?),0)=?
 ON CONFLICT DO NOTHING`;
export async function sha256(value) {
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function from64(s) {
 if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('INVALID_ENCODING');
 return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
}
export function deploymentState(env) {
 if(env.RELEASE_MODE!==undefined&&!['staging','private-live'].includes(env.RELEASE_MODE))denied(503,'Modalità applicativa non valida');
 return {stage:env.RELEASE_MODE!=='private-live',realDataAllowed:env.RELEASE_MODE==='private-live'};
}
function denied(code=401,message='Autenticazione richiesta') { throw Object.assign(Error(message),{status:code}); }
export async function verifyJWT(token,env,fetcher=fetch,now=Math.floor(Date.now()/1000)) {
 if(typeof token!=='string'||token.length>16384)denied();
 const parts=token.split('.');if(parts.length!==3)denied();
 let header,claim;try {header=JSON.parse(new TextDecoder().decode(from64(parts[0])));claim=JSON.parse(new TextDecoder().decode(from64(parts[1])));}catch{denied();}
 if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit||header.jku||header.jwk)denied();
 if(!env.ACCESS_ISSUER||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER)||!env.ACCESS_AUD)denied(503,'Protezione non configurata');
 if(claim.iss!==env.ACCESS_ISSUER||!Array.isArray(claim.aud)||!claim.aud.includes(env.ACCESS_AUD)||!Number.isFinite(claim.exp)||claim.exp<=now||!Number.isFinite(claim.iat)||claim.iat>now+30||(claim.nbf!==undefined&&(!Number.isFinite(claim.nbf)||claim.nbf>now+30))||typeof claim.sub!=='string'||!claim.sub||claim.sub.length>256||typeof claim.email!=='string')denied();
 const r=await fetcher(env.ACCESS_ISSUER+'/cdn-cgi/access/certs',{cf:{cacheTtl:300,cacheEverything:true}});if(!r.ok)denied(503,'Verifica identità temporaneamente non disponibile');
 const jwks=await r.json();const jwk=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
 if(!jwk)denied();
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,from64(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))denied();
 if(env.SYNC_SPACE!==undefined&&(typeof env.SYNC_SPACE!=='string'||!/^[a-z0-9-]{1,64}$/.test(env.SYNC_SPACE)))denied(503,'Spazio di prova non valido');
 // Server-controlled namespace: old archives remain untouched when starting a new trial.
 const identity=claim.iss+'|'+claim.sub+(env.SYNC_SPACE?'|space:'+env.SYNC_SPACE:'');
 return {id:await sha256(encoder.encode(identity)),email:claim.email};
}
export async function boundedBody(request,max=LIMIT) {
 const size=request.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>max))denied(413,'Dimensione oltre il limite della prova');
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader();let length=0;const parts=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();denied(413,'Dimensione oltre il limite della prova');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let p=0;for(const b of parts){bytes.set(b,p);p+=b.length;}return bytes;
}
export function validateEnvelope(x) {
 if(!x||Object.keys(x).sort().join(',')!=='ciphertext,files,format,iv,version'||x.format!=='luki-e2ee-snapshot'||x.version!==1||typeof x.iv!=='string'||from64(x.iv).length!==12||typeof x.ciphertext!=='string'||from64(x.ciphertext).length<16||!Array.isArray(x.files)||x.files.length>20000||x.files.some(f=>!HASH.test(f))||new Set(x.files).size!==x.files.length)denied(400,'Copia cifrata non valida');
 return x;
}
const json=(x,status=200)=>Response.json(x,{status});
function protect(response) {
 const headers=new Headers(response.headers);headers.set('Cache-Control','private, no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');headers.set('X-Frame-Options','DENY');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 return new Response(response.body,{status:response.status,headers});
}
async function head(db,user) {return await db.prepare('SELECT revision,operation_id,object_key,payload_sha256,created_at FROM revisions WHERE user_id=? ORDER BY revision DESC LIMIT 1').bind(user).first();}
export async function api(request,env,user) {
 if(request.headers.get('X-Luki-User')!==user.id)denied(403,'Account cambiato: riapri la pagina prima di sincronizzare');
 const url=new URL(request.url),path=url.pathname,db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 if(!['GET','HEAD'].includes(request.method)) {
  if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Luki-Request')!=='1')denied(403,'Origine della richiesta non valida');
 }
 if(path==='/_sync/session'&&request.method==='GET')return json({user:user.id,app:env.APP,...deploymentState(env)});
 if(path==='/_sync/head'&&request.method==='GET'){const row=await head(db,user.id);return json(row?{revision:row.revision,operationId:row.operation_id,createdAt:row.created_at}:{revision:0});}
 if(path==='/_sync/history'&&request.method==='GET'){
  const r=await db.prepare('SELECT revision,operation_id,created_at FROM revisions WHERE user_id=? ORDER BY revision DESC LIMIT 100').bind(user.id).all();
  const c=await db.prepare('SELECT operation_id,base_revision,created_at FROM conflict_copies WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all();return json({revisions:r.results,conflicts:c.results});
 }
 if(path==='/_sync/snapshot'&&request.method==='GET'){
  const revision=url.searchParams.get('revision'),conflict=url.searchParams.get('conflict');let row;
  if(conflict){if(!OP.test(conflict))denied(400);row=await db.prepare('SELECT object_key FROM conflict_copies WHERE user_id=? AND operation_id=?').bind(user.id,conflict).first();}
  else if(revision){if(!/^[1-9]\d{0,8}$/.test(revision))denied(400);row=await db.prepare('SELECT object_key FROM revisions WHERE user_id=? AND revision=?').bind(user.id,Number(revision)).first();}
  else row=await head(db,user.id);
  if(!row)return json({error:'Copia non trovata'},404);const object=await env.FILES.get(row.object_key);if(!object)denied(503,'Copia non disponibile: nessun dato locale deve essere sostituito');return new Response(object.body,{headers:{'Content-Type':'application/json'}});
 }
 if(path.startsWith('/_sync/blob/')) {
  const hash=path.slice('/_sync/blob/'.length);if(!HASH.test(hash))denied(400);const key=`${user.id}/blobs/${hash}`;
  if(request.method==='PUT') {const bytes=await boundedBody(request,2*1024*1024);if(bytes.length<28||await sha256(bytes)!==hash)denied(400,'Integrità allegato non valida');await env.FILES.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}});return json({hash});}
  if(request.method==='GET'||request.method==='HEAD'){const object=request.method==='HEAD'?await env.FILES.head(key):await env.FILES.get(key);if(!object)return json({error:'Allegato non trovato'},404);return new Response(request.method==='HEAD'?null:object.body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(object.size)}});}
 }
 if(path==='/_sync/commit'&&request.method==='POST') {
  let input;try{input=JSON.parse(new TextDecoder().decode(await boundedBody(request)));}catch(e){if(e.status)throw e;denied(400,'JSON non valido');}
  if(!input||Object.keys(input).sort().join(',')!=='baseRevision,envelope,operationId'||!Number.isSafeInteger(input.baseRevision)||input.baseRevision<0||input.baseRevision>100000000||!OP.test(input.operationId))denied(400,'Operazione non valida');
  const envelope=validateEnvelope(input.envelope),body=JSON.stringify(envelope),digest=await sha256(encoder.encode(body));
  const existing=await db.prepare('SELECT revision,payload_sha256 FROM revisions WHERE user_id=? AND operation_id=?').bind(user.id,input.operationId).first();
  if(existing){if(existing.payload_sha256!==digest)denied(409,'Identificativo già usato con dati diversi');return json({revision:existing.revision,operationId:input.operationId,replayed:true});}
  const previousConflict=await db.prepare('SELECT payload_sha256 FROM conflict_copies WHERE user_id=? AND operation_id=?').bind(user.id,input.operationId).first();
  if(previousConflict){if(previousConflict.payload_sha256!==digest)denied(409,'Identificativo già usato con dati diversi');return json({error:'Conflitto conservato',conflict:input.operationId,head:await head(db,user.id).then(r=>r?.revision||0)},409);}
  // All referenced immutable chunks must exist in this user's namespace before committing.
  for(let i=0;i<envelope.files.length;i+=16){const check=await Promise.all(envelope.files.slice(i,i+16).map(h=>env.FILES.head(`${user.id}/blobs/${h}`)));if(check.some(x=>!x))denied(422,'Allegato mancante: copia non pubblicata');}
  const objectKey=`${user.id}/snapshots/${crypto.randomUUID()}.json`;await env.FILES.put(objectKey,body,{httpMetadata:{contentType:'application/json'}});
  const result=await db.prepare(INSERT_REVISION).bind(user.id,input.baseRevision+1,input.operationId,objectKey,digest,user.id,input.baseRevision).run();
  if(result.meta.changes===1)return json({revision:input.baseRevision+1,operationId:input.operationId});
  const concurrentReplay=await db.prepare('SELECT revision,payload_sha256 FROM revisions WHERE user_id=? AND operation_id=?').bind(user.id,input.operationId).first();
  if(concurrentReplay){if(concurrentReplay.payload_sha256!==digest)denied(409,'Identificativo già usato con dati diversi');return json({revision:concurrentReplay.revision,operationId:input.operationId,replayed:true});}
  await db.prepare('INSERT INTO conflict_copies(user_id,operation_id,base_revision,object_key,payload_sha256) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(user.id,input.operationId,input.baseRevision,objectKey,digest).run();
  return json({error:'Modifiche concorrenti: entrambe le copie sono conservate',conflict:input.operationId,head:await head(db,user.id).then(r=>r?.revision||0)},409);
 }
 return json({error:'Operazione non disponibile'},404);
}
export async function handle(request,env,ctx) {
 let phase='AUTH';
 try {
  const user=await verifyJWT(request.headers.get('Cf-Access-Jwt-Assertion'),env);
  phase='ROUTE';
  const state=deploymentState(env);
  const url=new URL(request.url);
  if(url.origin!==env.ORIGIN)denied(403,'Indirizzo di prova non autorizzato');
  if(url.pathname.startsWith('/_sync/')){phase='SYNC';return protect(await api(request,env,user));}
  if(!['GET','HEAD'].includes(request.method))return protect(json({error:'Metodo non disponibile'},405));
  if(url.pathname==='/_luki/bootstrap.js')return protect(new Response(bootstrap,{headers:{'Content-Type':'text/javascript; charset=utf-8'}}));
  if(url.pathname==='/_luki/controller.js')return protect(new Response(controller,{headers:{'Content-Type':'text/javascript; charset=utf-8'}}));
  if(url.pathname==='/sync.js'&&env.APP==='tefinanza')return protect(new Response('/* Legacy transport replaced by isolated encrypted staging transport. */',{headers:{'Content-Type':'text/javascript'}}));
  --- TRUNCATED --- 14,265 chars