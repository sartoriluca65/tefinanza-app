import {writeFile} from 'node:fs/promises';
import {createBackup} from './backup.mjs';
import {profiles} from './repository.mjs';
import {fixture} from './fixture.mjs';
if(process.argv[1]?.endsWith('make-fixture.mjs')){
 try{const spec=profiles[process.argv[2]];if(!spec||!process.argv[3])throw Error();const b=await createBackup(spec,fixture(spec));await writeFile(process.argv[3],JSON.stringify(b),{flag:'wx',mode:0o600});console.log('SYNTHETIC_FIXTURE_CREATED');}
 catch{console.error('FIXTURE_NOT_CREATED');process.exitCode=1;}
}
