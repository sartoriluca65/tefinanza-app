export const enc=new TextEncoder();
export function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
// Decode both historical unpadded Base64URL and explicitly padded Base64.
// Do not pass malformed lengths/padding to the browser's native atob().
export function un64(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_+/-]*={0,2}$/.test(value))throw Error('Codifica Base64 non valida');
 const bare=value.replace(/=+$/,''),padding=value.length-bare.length,remainder=bare.length%4;
 if(remainder===1)throw Error('Lunghezza Base64 non valida');
 const required=(4-remainder)%4;
 if(padding&&(padding!==required||value.length%4!==0))throw Error('Padding Base64 non valido');
 const standard=bare.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat(required);
 let binary;try{binary=atob(standard);}catch{throw Error('Codifica Base64 non valida');}
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function recoveryBytes(text){
 if(typeof text!=='string')throw Error('Inserisci la chiave di sincronizzazione di questa app');
 // ASCII clipboard wrapping is formatting, never key material. Reject other characters.
 const compact=text.trim().replace(/[ \t\r\n]/g,'');
 if(!compact||compact.length>44)throw Error('La chiave deve contenere 43 caratteri Base64URL, oppure 44 con padding. Usa la chiave esistente di questa app, non il PIN o il codice email.');
 let raw;try{raw=un64(compact);}catch{throw Error('La chiave contiene una codifica Base64 non valida o incompleta. Copia la chiave esistente completa, senza modificarla.');}
 if(raw.length!==32)throw Error('La chiave di sincronizzazione deve contenere 32 byte: 43 caratteri Base64URL, oppure 44 con padding.');
 return raw;
}
export function normalizeRecovery(text){return b64(recoveryBytes(text));}
export async function importRecovery(text){return crypto.subtle.importKey('raw',recoveryBytes(text),'AES-GCM',false,['encrypt','decrypt']);}
export function createRecovery(){return b64(crypto.getRandomValues(new Uint8Array(32)));}
export async function seal(key,bytes,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,bytes));return {iv:b64(iv),ciphertext:b64(ciphertext)};}
export async function open(key,box,aad){if(un64(box.iv).length!==12)throw Error('Nonce non valido');return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(box.iv),additionalData:enc.encode(aad)},key,un64(box.ciphertext)));}
export function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
