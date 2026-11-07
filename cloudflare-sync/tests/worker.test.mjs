import test from 'node:test';import assert from 'node:assert/strict';
import {api,handle,verifyJWT,sha256} from '../worker.mjs';import {seal,importRecovery,b64} from '../crypto.mjs';import {makeEnv,USER,request} from './support.mjs';
for(const app of ['cartella-clinica','tefinanza','registro-credenziali'])test(app+': inizializzazione atomica, conflitti, replay e dati conservati',async()=>{
 const env=makeEnv(app),fp='b'.repeat(64),other='c'.repeat(64);const call=(p,b,h)=>api(request(env,p,b,h),env,USER);
 assert.equal((await (await call('key/state')).json()).canCreate,true);
 const claims=await Promise.all([call('key/initialize',{fingerprint:fp}),call('key/initialize',{fingerprint:other})]);assert.deepEqual(claims.map(x=>x.status).sort(),[200,409]);
 assert.equal((await (await call('key/state')).json()).canCreate,false);
 const key=await importRecovery(b64(new Uint8Array(32))),box=await seal(key,new TextEncoder().encode('synthetic'),app);
 const envelope={format:'luki-e2ee-snapshot',version:1,...box,files:[]},headers={'X-Luki-Key-Fingerprint':fp};
 const one={operationId:crypto.randomUUID(),baseRevision:0,envelope};const first=await call('commit',one,headers);assert.equal(first.status,200);
 assert.equal((await (await call('key/state')).json()).hasEncryptedCopy,true);
 assert.equal((await call('commit',one,headers)).status,200);assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM revisions').get().n,1);
 const two={...one,operationId:crypto.randomUUID()};assert.equal((await call('commit',two,headers)).status,409);
 assert.equal(env.sql.prepare('SELECT COUNT(*) AS n FROM conflict_copies').get().n,1);
 const count=env.objects.size;await assert.rejects(call('commit',{...two,baseRevision:1},{'X-Luki-Key-Fingerprint':other}),e=>e.status===409);assert.equal(env.objects.size,count);
 const before=JSON.stringify(env.sql.prepare('SELECT * FROM revisions').all());assert.equal((await call('key/initialize',{fingerprint:other})).status,409);assert.equal(JSON.stringify(env.sql.prepare('SELECT * FROM revisions').all()),before);
 // Legacy cloud data with no sync_keys row still blocks first-key generation.
 env.sql.prepare('DELETE FROM sync_keys').run();assert.equal((await (await call('key/state')).json()).canCreate,false);assert.equal((await call('key/initialize',{fingerprint:other})).status,409);
 await assert.rejects(api(request(env,'head',undefined,{'X-Luki-User':'d'.repeat(64)}),env,USER),e=>e.status===403);
});
test('JWT reale firmato: identità verificata, scadenza e audience; nessun bypass auth',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='synthetic';
 const env={ACCESS_ISSUER:'https://synthetic.cloudflareaccess.com',ACCESS_AUD:'synthetic-audience'},now=Math.floor(Date.now()/1000);
 const token=async overrides=>{const part=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),a=part({alg:'RS256',kid:'synthetic'}),b=part({iss:env.ACCESS_ISSUER,aud:[env.ACCESS_AUD],exp:now+300,iat:now,sub:'synthetic-user',email:'synthetic@example.invalid',...overrides});return a+'.'+b+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(a+'.'+b))).toString('base64url');};
 const fetcher=async()=>Response.json({keys:[jwk]});assert.equal((await verifyJWT(await token({}),env,fetcher,now)).id.length,64);await assert.rejects(verifyJWT(await token({exp:now-1}),env,fetcher,now));await assert.rejects(verifyJWT(await token({aud:['other']}),env,fetcher,now));
 const response=await handle(new Request('https://test.invalid/'),{ORIGIN:'https://test.invalid'},{});assert.equal(response.status,401);
 const nativeFetch=globalThis.fetch;let assets=0;globalThis.fetch=async(url,options)=>{if(String(url).endsWith('/certs'))return fetcher();assets++;assert.equal(new Headers(options.headers).has('Cf-Access-Jwt-Assertion'),false);assert.equal(new Headers(options.headers).has('Cookie'),false);assert.match(String(url),/^https:\/\/raw\.githubusercontent\.com\/sartoriluca65\/registro-credenziali\/[a-f0-9]{40}\/index\.html$/);return new Response('<html><head></head><body>synthetic</body></html>');};
 try{const deployment={...env,ORIGIN:'https://test.invalid',APP:'registro-credenziali',RELEASE_MODE:'staging',REPO:'sartoriluca65/registro-credenziali',SOURCE_BASE:'',TEST_SOURCE_SHA:'a'.repeat(40)};const req=()=>new Request(deployment.ORIGIN+'/',{headers:{'Cf-Access-Jwt-Assertion':signed}});const signed=await token({});const html=await handle(req(),deployment,{});assert.equal(html.status,200);assert.match(await html.text(),/LUKI_CONFIG/);assert.equal(assets,1);assert.equal((await handle(req(),{...deployment,RELEASE_MODE:'private-live'},{})).status,503);assert.equal(assets,1);}finally{globalThis.fetch=nativeFetch;}

});
