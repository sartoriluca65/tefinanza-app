import fs from 'node:fs';
const dir=new URL('./',import.meta.url);
const read=name=>fs.readFileSync(new URL(name,dir),'utf8');
const crypto=read('crypto.mjs').replace(/^export /gm,'');
const controller=read('controller.js').replace('// @CRYPTO@',crypto);
new Function(controller);
fs.writeFileSync(new URL('assets.mjs',dir),`// Generato da build.mjs: non modificare direttamente.\nexport const bootstrap=${JSON.stringify(read('bootstrap.js'))};\nexport const controller=${JSON.stringify(controller)};\n`);
