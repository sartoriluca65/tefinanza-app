import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const bootstrap=fs.readFileSync(path.join(dir,'bootstrap.js'),'utf8');
const crypto=fs.readFileSync(path.join(dir,'crypto.mjs'),'utf8').replace(/^export /gm,'');
const controller=fs.readFileSync(path.join(dir,'controller.js'),'utf8').replace('CRYPTO_IMPLEMENTATION',crypto).replace(/^ window\.LukiSyncTest=.*;$/m,'');
fs.writeFileSync(path.join(dir,'assets.mjs'),`export const bootstrap=${JSON.stringify(bootstrap)};\nexport const controller=${JSON.stringify(controller)};\n`);
console.log('Transport assets built; no personal data included.');
