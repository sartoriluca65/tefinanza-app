// Node-only staging tool. Does not read browser storage or access the network.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyBackup,sha256} from './backup.mjs';
import {profiles} from './repository.mjs';
export async function stage(spec,input,destination) {
  const text=typeof input==='string'?input:JSON.stringify(input);
  await verifyBackup(spec,text); // Complete validation before any output is created.
  const directory=resolve(destination);await mkdir(directory); // Exclusive; an existing directory is never touched.
  const file=join(directory,'backup.json');await writeFile(file,text,{flag:'wx',mode:0o600});
  const persisted=await readFile(file,'utf8');await verifyBackup(spec,persisted);
  if(await sha256(new TextEncoder().encode(text))!==await sha256(new TextEncoder().encode(persisted)))throw Error('STAGING_VERIFICATION_FAILED');
  // This marker is written last. A directory without it is incomplete, never a verified backup.
  await writeFile(join(directory,'VERIFIED.json'),JSON.stringify({format:'luki-staging-receipt',version:1,app:spec.id,sha256:await sha256(new TextEncoder().encode(persisted)),scope:'isolated-staging-only'})+'\n',{flag:'wx',mode:0o600});
  return 'STAGED_AND_REREAD_NOT_IMPORTED_IN_APPLICATION';
}
export async function main(args) {
  const [command,profile,input,output]=args,spec=profiles[profile];
  if(!spec||!['verify','stage'].includes(command)||!input)throw Error('USAGE: node offline.mjs verify|stage PROFILE SYNTHETIC_INPUT [NEW_DIRECTORY]');
  const text=await readFile(input,'utf8');
  if(command==='verify'){await verifyBackup(spec,text);return 'FORMAT_AND_COMPLETENESS_VERIFIED';}
  if(!output)throw Error('NEW_DIRECTORY_REQUIRED');return stage(spec,text,output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(await main(process.argv.slice(2)));}catch(error){console.error(/^[A-Z_]+$/.test(error.message)?error.message:'OFFLINE_OPERATION_FAILED');process.exitCode=1;}
}
