import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];let scripts=0,resources=0;
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.git','node_modules'].includes(item.name))continue;
  const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else files.push(file);
}}
walk(root);
function checkResource(file,value){
  if(!value||/^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(value)||value.includes('${'))return;
  const clean=decodeURIComponent(value.split(/[?#]/)[0]);if(!clean)return;
  const target=clean.startsWith('/')?path.join(root,clean):path.resolve(path.dirname(file),clean);
  if(!fs.existsSync(target))throw Error(path.relative(root,file)+': risorsa assente '+value);
  resources++;
}
for(const file of files){
  if(/\.(?:js|mjs|cjs)$/.test(file)){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0)throw Error(result.stderr||'Controllo JavaScript non riuscito: '+file);scripts++;
  }else if(file.endsWith('.html')){
    const html=fs.readFileSync(file,'utf8');
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
      const attrs=match[1],src=attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if(src){checkResource(file,src[1]);continue;}
      const type=attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
      if(type&&!/^(?:text\/javascript|application\/javascript)$/.test(type))continue;
      new vm.Script(match[2],{filename:path.relative(root,file)+' inline'});scripts++;
    }
    const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,'');
    for(const match of markup.matchAll(/<(?:img|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi))checkResource(file,match[1]);
  }else if(/\.(?:json|webmanifest)$/.test(file))JSON.parse(fs.readFileSync(file,'utf8'));
}
console.log(`Struttura valida: ${files.length} file, ${scripts} script e ${resources} riferimenti locali.`);
