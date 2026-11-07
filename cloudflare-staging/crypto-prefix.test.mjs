import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as c from './crypto.mjs';
import * as legacy from './test-legacy-crypto.mjs';
const app='tefinanza';
 const raw=Uint8Array.from({length:32},(_,i)=>(i*37+251)%256),code=legacy.b64(raw),aad='luki-v1|'+app+'|synthetic-owner|snapshot',fp=await legacy.hash(raw);
 test(app+': reported 45/44 punctuation shape reproduces old failure; suggestion keeps bytes',async()=>{
  for(const marker of [':',';','.',')','!','，']){const text=marker+' '+code;assert.equal(text.length,45);assert.throws(()=>c.recoveryBytes(text),/codifica Base64 non valida/);assert.equal(c.leadingPunctuationRecovery(text),code);assert.deepEqual(c.recoveryBytes(code),legacy.un64(code));}
 });
 test(app+': cannot silently strip internal punctuation or accept arbitrary formats',()=>{
  for(const text of [code,code+'.',code.slice(0,5)+':'+code.slice(5),':: '+code,'" '+code,'• '+code,'— '+code,'= '+code,': '+code.slice(1),': '+'A'.repeat(44)])assert.equal(c.leadingPunctuationRecovery(text),null,text);
 });
 test(app+': no existing archive or mismatching fingerprint fails before activation',async()=>{
  let calls=0;const verifyRemote=async()=>{calls++};await assert.rejects(c.verifyExistingRecovery(code,{verifyRemote}),/Nessun archivio/);await assert.rejects(c.verifyExistingRecovery(code,{fingerprint:'wrong',revision:1,verifyRemote}),/non corrisponde/);assert.equal(calls,0);
 });
 test(app+': existing fingerprint or authenticated historical ciphertext proves same key',async()=>{
  const bytes=c.enc.encode('synthetic historical data'),box=await legacy.seal(await legacy.importRecovery(code),bytes,aad),before=JSON.stringify(box);let checks=0;
  const originalRandom=crypto.getRandomValues;crypto.getRandomValues=()=>{throw Error('Unexpected key generation')};
  try{const verified=await c.verifyExistingRecovery(code,{revision:3,verifyRemote:async(revision,key)=>{assert.equal(revision,3);checks++;assert.deepEqual(await c.open(key,box,aad),bytes)}});assert.equal(verified.fingerprint,fp);assert.equal(verified.candidate.extractable,false);await c.verifyExistingRecovery(code,{fingerprint:fp,verifyRemote:()=>{throw Error('No remote needed')}});}finally{crypto.getRandomValues=originalRandom;}
  assert.equal(checks,1);assert.equal(JSON.stringify(box),before);
 });
 test(app+': wrong key, modified ciphertext and different app/AAD still fail',async()=>{
  const box=await legacy.seal(await legacy.importRecovery(code),c.enc.encode('synthetic only'),aad),wrong=c.b64(new Uint8Array(32));
  await assert.rejects(c.verifyExistingRecovery(wrong,{revision:1,verifyRemote:async(_,key)=>c.open(key,box,aad)}));
  await assert.rejects(c.verifyExistingRecovery(code,{fingerprint:fp,revision:1,verifyRemote:async(_,key)=>c.open(key,box,aad+'different')}));
  const bytes=c.un64(box.ciphertext);bytes[0]^=1;await assert.rejects(c.verifyExistingRecovery(code,{revision:1,verifyRemote:async(_,key)=>c.open(key,{...box,ciphertext:c.b64(bytes)},aad)}));
 });
