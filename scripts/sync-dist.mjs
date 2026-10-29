import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
let count=0;
function copy(source,target){
  if(fs.statSync(source).isDirectory()){
    for(const name of fs.readdirSync(source))copy(path.join(source,name),path.join(target,name));
    return;
  }
  const data=fs.readFileSync(source);
  if(check){
    if(!fs.existsSync(target)||!data.equals(fs.readFileSync(target)))throw Error('Copia di pubblicazione disallineata: '+path.relative(root,target));
  }else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);}
  count++;
}
for(const name of fs.readdirSync(root)){
  if(['assets','vendor'].includes(name)||/\.(?:js|css|html|png|ico|jpeg|webmanifest)$/.test(name))copy(path.join(root,name),path.join(root,'dist',name));
}
console.log(`${count} risorse ${check?'verificate':'allineate'} in dist/.`);
