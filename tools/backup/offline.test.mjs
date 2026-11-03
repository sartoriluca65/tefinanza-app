import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stage} from './offline.mjs';
import {createBackup} from './backup.mjs';
import {diviso} from './profiles.mjs';
const sample={localStorage:{'diviso-v2':'{"people":[],"expenses":[],"groups":[]}'},databases:[]};
test('offline staging rereads a complete copy and never overwrites a valid directory',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'backup-synthetic-')),dest=join(parent,'new');
 const b=await createBackup(diviso,sample);await stage(diviso,b,dest);
 const saved=await readFile(join(dest,'backup.json'),'utf8');assert.deepEqual(JSON.parse(saved),b);
 const receipt=JSON.parse(await readFile(join(dest,'VERIFIED.json'),'utf8'));assert.equal(receipt.scope,'isolated-staging-only');
 await assert.rejects(stage(diviso,b,dest));assert.equal(await readFile(join(dest,'backup.json'),'utf8'),saved);
});
test('invalid or truncated input produces no destination directory',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'backup-synthetic-')),dest=join(parent,'new');
 await assert.rejects(stage(diviso,'{"format":',dest));assert.deepEqual(await readdir(parent),[]);
});
test('an interrupted staging directory is left untouched and cannot be reused',async()=>{
 const parent=await mkdtemp(join(tmpdir(),'backup-synthetic-')),dest=join(parent,'interrupted');await mkdir(dest);
 await writeFile(join(dest,'backup.json'),'synthetic incomplete file');
 const b=await createBackup(diviso,sample);await assert.rejects(stage(diviso,b,dest));
 assert.equal(await readFile(join(dest,'backup.json'),'utf8'),'synthetic incomplete file');
 assert.deepEqual(await readdir(dest),['backup.json']);
});
