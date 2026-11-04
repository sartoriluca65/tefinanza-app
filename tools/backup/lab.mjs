import {profiles} from './repository.mjs';
import {fixture} from './fixture.mjs';
import {createBackup,verifyBackup,downloadBackup,browserSandbox,restoreToNewSandbox} from './backup.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
 for(const button of document.querySelectorAll('button,input,select'))button.disabled=true;
 status('Laboratorio disabilitato: aprire una copia su localhost.');
}else{
 for(const name of Object.keys(profiles))$('profile').add(new Option(name,name));
 const selected=()=>profiles[$('profile').value];let busy=false;
 async function work(fn){if(busy)return;busy=true;try{await fn();}catch{status('Operazione rifiutata o non completata. Nessun archivio applicativo è stato sostituito.');}finally{busy=false;}}
 async function read(){const file=$('input').files[0];if(!file||file.size>64*1024*1024)throw Error();return file.text();}
 $('fixture').onclick=()=>work(async()=>{const spec=selected();await downloadBackup(spec,await createBackup(spec,fixture(spec)),window);status('Download dell’esempio richiesto. Il file salvato non è ancora verificato.');});
 $('verify').onclick=()=>work(async()=>{await verifyBackup(selected(),await read());status('Formato, integrità e completezza dei riferimenti controllati. Riapertura nell’app originale non verificata.');});
 $('restore').onclick=()=>work(async()=>{await restoreToNewSandbox(selected(),await read(),browserSandbox(window));status('Copia importata in un nuovo database di laboratorio. Nessun dato dell’app originale è stato modificato.');});
}
