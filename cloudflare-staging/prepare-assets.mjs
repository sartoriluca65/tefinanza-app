import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
export function manifestFor(repositoryRoot,sourceBase=''){
 const prefix=sourceBase.replace(/\/$/,'');const manifest={},files={};
 const tracked=execFileSync('git',['ls-files','-z'],{cwd:repositoryRoot,encoding:'utf8'}).split('\0').filter(Boolean);
 for(const trackedPath of tracked){
  if(prefix&&!trackedPath.startsWith(prefix+'/'))continue;
  const relative=prefix?trackedPath.slice(prefix.length+1):trackedPath;
  if(relative.split('/').some(p=>p.startsWith('.'))||/^(tools|tests|scripts|src|cloudflare-staging|node_modules)\//.test(relative)||/^(README\.md|package(-lock)?\.json|AGENTS\.md)$/.test(relative))continue;
  const full=path.join(repositoryRoot,trackedPath),bytes=fs.readFileSync(full);if(bytes.length>25*1024*1024)throw Error('Asset exceeds platform limit: '+relative);
  const hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,32);
  manifest['/'+relative]={hash,size:bytes.length};files[hash]={path:full,relative};
 }
 if(!manifest['/index.html'])throw Error('Missing application entrypoint');return {manifest,files};
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
 const [root,sourceBase,out]=process.argv.slice(2);const result=manifestFor(root,sourceBase);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result));console.log(JSON.stringify({files:Object.keys(result.manifest).length,bytes:Object.values(result.manifest).reduce((n,v)=>n+v.size,0)}));
}
