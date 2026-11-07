import test from 'node:test';import assert from 'node:assert/strict';
import {b64,un64,recoveryBytes,normalizeRecovery,importRecovery,createRecovery,seal,open} from '../crypto.mjs';
for(const app of ['cartella-clinica','tefinanza','registro-credenziali']){
 test(app+': roundtrip, copia/incolla, formato precedente e ciphertext',async()=>{
  for(let seed=0;seed<256;seed++){const raw=Uint8Array.from({length:32},(_,i)=>(seed+i)%256),text=b64(raw);assert.equal(text.length,43);assert.deepEqual(recoveryBytes(text),raw);assert.deepEqual(un64(Buffer.from(raw).toString('base64')),raw);assert.equal(normalizeRecovery(text.slice(0,10)+' \n\u00a0\u202f\u200b\u2060\ufeff'+text.slice(10)),text);}
  // Test generator with synthetic keys only; no user/browser storage or cloud writes.
  for(let i=0;i<32;i++)assert.equal(recoveryBytes(createRecovery()).length,32);
  const raw=Uint8Array.from({length:32},(_,i)=>i),key=await importRecovery(b64(raw));
  const aad='luki-v1|'+app+'|'+'a'.repeat(64)+'|snapshot',iv=Uint8Array.from({length:12},(_,i)=>i);
  const oldKey=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
  const old={iv:Buffer.from(iv).toString('base64url'),ciphertext:Buffer.from(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad)},oldKey,new TextEncoder().encode('historical'))).toString('base64url')};
  assert.equal(new TextDecoder().decode(await open(key,old,aad)),'historical');
  const box=await seal(key,new TextEncoder().encode('new'),aad);assert.equal(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(box.iv,'base64url'),additionalData:new TextEncoder().encode(aad)},oldKey,Buffer.from(box.ciphertext,'base64url'))),'new');
  await assert.rejects(open(key,box,aad+'wrong'));
 });
 test(app+': chiavi incomplete, caratteri errati, padding',()=>{const key=b64(new Uint8Array(32));for(const s of ['',key.slice(0,37),key.slice(0,42),key+'==',key.slice(0,10)+'!'+key.slice(11),'password scelta da me',key.slice(0,10)+'“'+key.slice(11)])assert.throws(()=>recoveryBytes(s));assert.equal(normalizeRecovery(key+'='),key);});
}
