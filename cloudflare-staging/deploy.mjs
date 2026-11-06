// Explicit staging-only API deployment, no local credentials stored in files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {manifestFor} from './prepare-assets.mjs';
import './build.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const cfg=JSON.parse(fs.readFileSync(path.join(dir,'deployment.json'),'utf8'));
if(!/^luki-[a-z-]+-staging$/.test(cfg.worker)||!cfg.bucket.endsWith('-staging-files')||!cfg.databaseName.endsWith('-staging-db')||!cfg.origin.endsWith('.workers.dev')||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(cfg.issuer))throw Error('Only isolated staging configuration is allowed');
const token=process.env.CLOUDFLARE_API_TOKEN;if(!token)throw Error('Configure CLOUDFLARE_API_TOKEN as a protected GitHub Actions secret; never commit it.');
async function call(suffix,method='GET',body){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/${suffix}`,{method,headers:{Authorization:`Bearer ${token}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});const result=await r.json();if(!r.ok||!result.success)throw Error(`Cloudflare ${method} ${suffix}: ${r.status}`);return result.result;}
const access=await call('access/apps/'+cfg.accessAppId);if(access.aud!==cfg.audience||access.domain!==new URL(cfg.origin).hostname||!access.policies?.length)throw Error('Access protection does not match staging');
const db=await call('d1/database/'+cfg.databaseId);if(db.name!==cfg.databaseName)throw Error('Database identity mismatch');
const root=path.resolve(dir,'..');
execFileSync('git',['diff','--quiet',cfg.sourceSha,'--','.',':(exclude)cloudflare-staging',':(exclude).github/workflows/cloudflare-staging.yml'],{cwd:root});
const bundle=manifestFor(root,cfg.sourceBase);
const session=await call('workers/scripts/'+cfg.worker+'/assets-upload-session','POST',{manifest:bundle.manifest});let completion=session.jwt;
for(const bucket of session.buckets){const form=new FormData();for(const hash of bucket){const file=bundle.files[hash],ext=path.extname(file.relative).slice(1),mime=({html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',ico:'image/x-icon',wasm:'application/wasm',json:'application/json',webmanifest:'application/manifest+json',ttf:'font/ttf',woff2:'font/woff2'})[ext]||'application/octet-stream';form.append(hash,new Blob([fs.readFileSync(file.path).toString('base64')],{type:mime}));}const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/workers/assets/upload?base64=true`,{method:'POST',headers:{Authorization:`Bearer ${session.jwt}`},body:form});const result=await r.json();if(!r.ok||!result.success)throw Error('Static assets upload failed: '+r.status);if(result.result?.jwt)completion=result.result.jwt;}
const metadata={main_module:'worker.mjs',compatibility_date:'2026-11-06',assets:{jwt:completion,config:{html_handling:'none',run_worker_first:true}},bindings:[{type:'assets',name:'ASSETS'},{type:'d1',name:'DB',database_id:cfg.databaseId},{type:'r2_bucket',name:'FILES',bucket_name:cfg.bucket},...Object.entries({APP:cfg.app,ACCESS_ISSUER:cfg.issuer,ACCESS_AUD:cfg.audience,ORIGIN:cfg.origin,REPO:cfg.repository,SOURCE_SHA:cfg.sourceSha,SOURCE_BASE:cfg.sourceBase}).map(([name,text])=>({type:'plain_text',name,text}))],observability:{enabled:true,redact_query_string:true,logs:{enabled:true,invocation_logs:false,head_sampling_rate:0.05},traces:{enabled:true,head_sampling_rate:0.01}},tags:['lukiapp-staging','synthetic-data-only']};
const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));for(const name of ['worker.mjs','assets.mjs'])form.append(name,new Blob([fs.readFileSync(path.join(dir,name),'utf8')],{type:'application/javascript+module'}),name);
await call('workers/scripts/'+cfg.worker,'PUT',form);
await call('workers/scripts/'+cfg.worker+'/subdomain','POST',{enabled:true,previews_enabled:false});
console.log('Private staging deployed: '+cfg.origin+' — no personal data migrated.');
