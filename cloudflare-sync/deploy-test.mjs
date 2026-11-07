// Solo ambienti isolati di prova. Non esiste un percorso di deploy produzione.
// Il token è fornito dal gestore credenziali dell'ambiente; non salvarlo nel repo.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import './build.mjs';
const config=JSON.parse(fs.readFileSync(new URL('test-deployment.json',import.meta.url),'utf8'));
if(!config.name.endsWith('-keyfix-test')||config.release_mode!=='staging')throw Error('Deploy rifiutato: consentito solo ambiente keyfix-test in staging');
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Configurare CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID nel gestore credenziali, non nel repository.');
const base=`https://api.cloudflare.com/client/v4/accounts/${account}`;
async function call(path,options){const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+token);const r=await fetch(base+path,{...options,headers});const data=await r.json();if(!r.ok||!data.success)throw Error(`API ${r.status}: ${JSON.stringify(data.errors)}`);return data;}
const codeSha=execFileSync('git',['rev-parse','HEAD'],{cwd:new URL('./',import.meta.url),encoding:'utf8'}).trim();
const bindings=[{name:'DB',type:'d1',id:config.db},{name:'FILES',type:'r2_bucket',bucket_name:config.bucket},...Object.entries({SYNC_CODE_SHA:codeSha,APP:config.app,ORIGIN:config.origin,ACCESS_AUD:config.aud,ACCESS_ISSUER:'https://proud-rain-876d.cloudflareaccess.com',RELEASE_MODE:'staging',REPO:config.repo,SOURCE_BASE:config.source_base,TEST_SOURCE_SHA:config.source_sha}).map(([name,text])=>({name,text,type:'plain_text'}))];
await call(`/d1/database/${config.db}/query`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql:fs.readFileSync(new URL('schema.sql',import.meta.url),'utf8')})});
const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'worker.mjs',bindings,compatibility_date:config.compatibility_date,tags:['luki-keyfix-test','synthetic-data-only'],observability:{enabled:true,redact_query_string:true,logs:{enabled:true,invocation_logs:false},traces:{enabled:true}}})],{type:'application/json'}));
for(const name of ['worker.mjs','assets.mjs','crypto.mjs'])form.append(name,new Blob([fs.readFileSync(new URL(name,import.meta.url))],{type:'application/javascript+module'}),name);
await call(`/workers/scripts/${config.name}`,{method:'PUT',body:form});
await call(`/workers/scripts/${config.name}/subdomain`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
console.log('Pubblicato ambiente di prova:',config.origin);
