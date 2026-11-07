// Formato storico: 32 byte AES-GCM, Base64URL senza padding (43 caratteri).
// Non è una password e non si applica alcuna derivazione PBKDF2.
export const enc=new TextEncoder();
export function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
export function un64(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_+/-]*={0,2}$/.test(value))throw Error('BASE64_CHARACTERS');
 const bare=value.replace(/=+$/,''),padding=value.length-bare.length,remainder=bare.length%4;
 if(remainder===1)throw Error('BASE64_LENGTH');
 const required=(4-remainder)%4;
 if(padding&&(padding!==required||value.length%4!==0))throw Error('BASE64_PADDING');
 let binary;try{binary=atob(bare.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat(required));}catch{throw Error('BASE64_ENCODING');}
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export async function hash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function recoveryBytes(text){
 if(typeof text!=='string')throw Error('Inserisci la chiave di sincronizzazione esistente.');
 // Solo separatori del copia/incolla, mai sostituzioni di lettere o punteggiatura.
 const compact=text.replace(/[\s\u200B\u2060]/gu,'');
 const invalid=[...compact].filter(c=>!/[A-Za-z0-9_+/=\-]/.test(c)).length;
 if(invalid)throw Error(`Chiave non valida: ${compact.length} caratteri, ${invalid} non ammessi. Copia la chiave originale completa.`);
 if(compact.length!==43&&compact.length!==44)throw Error(`Chiave incompleta o di lunghezza errata: ${compact.length} caratteri. Ne servono 43, oppure 44 con = finale. Non aggiungere caratteri a tentativi.`);
 let raw;try{raw=un64(compact);}catch{throw Error('Padding o codifica Base64 non validi. Copia la chiave originale completa.');}
 if(raw.length!==32)throw Error('La chiave deve rappresentare esattamente 32 byte.');
 return raw;
}
export function normalizeRecovery(text){return b64(recoveryBytes(text));}
export async function importRecovery(text){return crypto.subtle.importKey('raw',recoveryBytes(text),'AES-GCM',false,['encrypt','decrypt']);}
export function createRecovery(){const raw=crypto.getRandomValues(new Uint8Array(32)),text=b64(raw),check=recoveryBytes(text);if(text.length!==43||check.some((n,i)=>n!==raw[i]))throw Error('Generazione chiave non riuscita: nessun dato modificato.');return text;}
export async function seal(key,bytes,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,bytes));return {iv:b64(iv),ciphertext:b64(ciphertext)};}
export async function open(key,box,aad){const iv=un64(box.iv);if(iv.length!==12)throw Error('Nonce non valido');return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,un64(box.ciphertext)));}
export function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
