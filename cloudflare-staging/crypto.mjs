export const enc=new TextEncoder();
export function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
export function un64(s){if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Codifica non valida');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function importRecovery(text){const raw=un64(text.trim());if(raw.length!==32)throw Error('La chiave di sincronizzazione deve contenere 32 byte casuali');return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
export function createRecovery(){return b64(crypto.getRandomValues(new Uint8Array(32)));}
export async function seal(key,bytes,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,bytes));return {iv:b64(iv),ciphertext:b64(ciphertext)};}
export async function open(key,box,aad){if(un64(box.iv).length!==12)throw Error('Nonce non valido');return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(box.iv),additionalData:enc.encode(aad)},key,un64(box.ciphertext)));}
export function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
