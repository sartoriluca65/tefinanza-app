// Credenziale locale: solo CryptoKey AES-GCM non esportabile. Mai una chiave raw.
// Il chiamante usa IndexedDB nativo del trasporto, fuori dagli snapshot dell'app.
export function createDeviceKeyStore({app,user,aad,read,write,remove,getFingerprint,getRevision,advanceRevision,withLock=fn=>fn()}){
 const name='device-key-v1',proof='luki-device-key-v1';
 function assertKey(key){if(!key||key.type!=='secret'||key.extractable!==false||key.algorithm?.name!=='AES-GCM'||key.algorithm?.length!==256||!key.usages.includes('encrypt')||!key.usages.includes('decrypt'))throw Error('Chiave locale non valida: reinserisci la chiave esistente.');}
 function assertRevision(revision){if(getRevision()!==revision)throw Error('Associazione del dispositivo cambiata: nessun dato modificato.');}
 async function validate(record){
  if(record.version!==1||record.app!==app||record.user!==user||record.fingerprint!==getFingerprint())throw Error('La chiave locale non corrisponde a questo archivio. Reinserisci la chiave esistente.');
  assertRevision(record.revision);assertKey(record.key);
  const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.check.iv,additionalData:new TextEncoder().encode(aad+'|device-key')},record.key,record.check.ciphertext);
  if(new TextDecoder().decode(clear)!==proof)throw Error('Verifica della chiave locale non riuscita.');
  assertRevision(record.revision);return record.key;
 }
 return {
  async save(key,fingerprint,revision=getRevision()){
   assertKey(key);return withLock(async()=>{
    assertRevision(revision);const iv=crypto.getRandomValues(new Uint8Array(12));
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad+'|device-key')},key,new TextEncoder().encode(proof));
    assertRevision(revision);const record={version:1,app,user,fingerprint,revision,key,check:{iv,ciphertext}};
    // Un read-back verifica anche il supporto di structured-clone CryptoKey del browser.
    await write(name,record);const saved=await read(name);assertRevision(revision);
    assertKey(saved?.key);if(saved?.fingerprint!==fingerprint||saved?.revision!==revision)throw Error('Salvataggio della chiave locale non riuscito.');
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:saved.check.iv,additionalData:new TextEncoder().encode(aad+'|device-key')},saved.key,saved.check.ciphertext);
    if(new TextDecoder().decode(clear)!==proof)throw Error('La chiave non è stata riletta correttamente dal browser.');
    assertRevision(revision);return saved.key;
   });
  },
  async load(){const revision=getRevision(),record=await read(name);assertRevision(revision);return record?validate(record):null;},
  async forget(){advanceRevision();return withLock(()=>remove(name));}
 };
}
