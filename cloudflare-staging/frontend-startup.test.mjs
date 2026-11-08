import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {withReadyUI,READY_STARTUP,STARTUP_MARKER} from './frontend-startup.mjs';
import {handle} from './worker.mjs';
test('avvio attende tutti gli script e avviene una sola volta',()=>{let calls=0;const document=new EventTarget();document.readyState='loading';vm.runInNewContext(withReadyUI('initialize();'),{document,initialize:()=>calls++});assert.equal(calls,0);document.dispatchEvent(new Event('DOMContentLoaded'));document.dispatchEvent(new Event('DOMContentLoaded'));assert.equal(calls,1);});
test('avvio diretto se il DOM è già pronto; trasformazione idempotente',()=>{let calls=0;vm.runInNewContext(withReadyUI('initialize();'),{document:{readyState:'complete'},initialize:()=>calls++});assert.equal(calls,1);assert.equal(withReadyUI(READY_STARTUP),READY_STARTUP);assert.throws(()=>withReadyUI('otherBoot();'));});
test('sorgente app attuale contiene il bootstrap corretto e nessuna chiamata prematura',()=>{const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');assert(source.includes(STARTUP_MARKER));assert.equal(withReadyUI(source),source);assert(!/^initialize\(\);$/m.test(source));new vm.Script(source);});
test('Worker corregge l’asset legacy solo dopo Access e invalida header obsoleti',async()=>{
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'synthetic-startup'};
 const now=Math.floor(Date.now()/1000),issuer='https://synthetic.cloudflareaccess.com';const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const header=b64({alg:'RS256',kid:jwk.kid}),claim=b64({iss:issuer,aud:['synthetic'],sub:'startup-test',email:'synthetic@example.invalid',iat:now,exp:now+60}),payload=header+'.'+claim;
 const token=payload+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(payload))).toString('base64url');let assetCalls=0;
 const env={APP:'tefinanza',ORIGIN:'https://synthetic.invalid',ACCESS_ISSUER:issuer,ACCESS_AUD:'synthetic',ASSETS:{async fetch(){assetCalls++;return new Response('initialize();',{headers:{'Content-Type':'text/javascript','Content-Length':'13',ETag:'old-asset'}});}}};
 const original=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 try{assert.equal((await handle(new Request(env.ORIGIN+'/app.js'),env,{})).status,401);assert.equal(assetCalls,0);
  const r=await handle(new Request(env.ORIGIN+'/app.js?v=legacy',{headers:{'Cf-Access-Jwt-Assertion':token}}),env,{});assert.equal(r.status,200);assert((await r.text()).includes(STARTUP_MARKER));assert.equal(r.headers.get('Content-Length'),null);assert.equal(r.headers.get('ETag'),null);assert.match(r.headers.get('Cache-Control'),/no-store/);
 }finally{globalThis.fetch=original;}
});
