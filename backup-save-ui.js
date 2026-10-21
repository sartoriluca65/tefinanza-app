'use strict';

function renderBackupReceipt(){
  let r=state.lastBackupReceipt,target=$('#backupSaveResult');
  if(!target)return;
  if(!r){target.hidden=true;return}
  target.hidden=false;
  target.className='notice backup-receipt '+(r.verified===true?'verified':'');
  target.innerHTML=`<b>${r.verified===true?'Copia salvata · contenuto verificato':'Salvataggio confermato da te'}</b><p>${esc(new Date(r.at).toLocaleString('it-IT'))}<br>File: <strong>${esc(r.filename)}</strong>${r.directory?'<br>Cartella selezionata: <strong>'+esc(r.directory)+'</strong><br>Riferimento: '+esc(r.directory+'/'+r.filename):''}</p><p class="small">${r.verified===true?'La scrittura e il contenuto del file sono stati verificati.':'L’app non può verificare direttamente il file salvato tramite il menu di sistema: la conferma è stata data da te.'} Il browser non rende disponibile il percorso assoluto completo. L’eventuale sincronizzazione NAS/cloud dipende dalla posizione scelta.</p>`
}

function chooseBackupDestination(preventive=false){
  const dialog=$('#backupSaveModal');
  if(dialog.open)return Promise.resolve(false);
  return new Promise(resolve=>{
    let folder=null,folderPermissionConfirmed=false,prepared=null,preparedName='',objectURL='',finished=false,overwriteName='';
    const hasDir=typeof window.showDirectoryPicker==='function';
    const hasSave=typeof window.showSaveFilePicker==='function';
    const hasShare=typeof navigator.share==='function'&&typeof navigator.canShare==='function';
    const name='TeFinanza-'+(preventive?'sicurezza-':'backup-')+today().replaceAll('-','')+'-'+new Date().toLocaleTimeString('sv-SE').replaceAll(':','')+'.json';
    const finish=ok=>{if(finished)return;finished=true;dialog.close();if(objectURL)setTimeout(()=>URL.revokeObjectURL(objectURL),60000);resolve(ok)};
    const locationOptions='<option value="downloads">Download</option><option value="documents">Documenti</option><option value="desktop">Scrivania / Desktop</option><option value="external">Unità USB o esterna</option><option value="cloud">Cartella cloud sincronizzata</option><option value="other">Altra cartella</option>';
    $('#backupSaveContent').innerHTML=`<h2>${preventive?'Salva una copia prima del ripristino':'Salva una copia completa'}</h2><p>La copia include conti, operazioni, bollette e documenti originali. Scegli dove conservarla prima di confermare.</p><label>Nome della copia<input id="backupOutputName" value="${esc(name)}" maxlength="180"></label><label>Posizione frequente<select id="backupLocation">${locationOptions}</select></label><p class="small">La posizione scelta è il punto di partenza. Per USB, unità esterne, NAS e cloud usa Sfoglia… e seleziona una cartella già disponibile sul dispositivo.</p><div class="toolbar"><button class="btn" id="browseBackup">Sfoglia…</button></div><p id="backupDestination" class="notice" role="status">${hasDir?'Scegli una posizione frequente e premi Sfoglia… per selezionare la cartella.':hasSave?'Scegli nome e cartella nella finestra Salva con nome.':'Questo browser non apre direttamente un selettore di cartelle. Premi Sfoglia… per preparare la copia, poi scegli la destinazione dal menu di sistema oppure usa File → Salva con nome dalla scheda della copia.'}</p>${hasDir?'<div class="toolbar"><button class="btn" id="confirmBackupFolder" disabled>Conferma percorso e permesso di scrittura</button></div>':''}<label class="check hidden" id="backupOverwriteLabel"><input type="checkbox" id="backupOverwrite"> Autorizzo la sostituzione del file esistente con lo stesso nome.</label><p id="backupSaveError" class="inline-error hidden" role="alert"></p><div id="backupSystemActions" class="hidden"><div class="toolbar">${hasShare?'<button class="btn primary" id="shareBackupFile">Apri menu Salva su File / condivisione</button>':''}<button class="btn" id="openBackupFile">Apri copia · File → Salva con nome</button></div><p class="small">Su iPhone scegli Salva su File e la cartella. Su Safari Mac puoi aprire la copia in una scheda e usare File → Salva con nome. Non vengono copiati testi negli appunti e non viene avviato un download automatico.</p><label class="check"><input type="checkbox" id="backupManualVerified"> Ho verificato che il file sia stato salvato nella cartella scelta.</label><button class="btn" id="confirmManualBackup" disabled>Conferma il salvataggio</button></div><div class="dialog-actions"><button class="btn" id="cancelBackupSave">Annulla</button>${hasDir?'<button class="btn primary" id="saveBackupToFolder" disabled>Crea copia nella cartella scelta</button>':''}</div><p class="small">Il percorso assoluto completo non è accessibile al sito per protezione del dispositivo. Verranno mostrati i nomi effettivi di cartella e file quando disponibili.</p>`;

    const error=e=>{let out=$('#backupSaveError');out.classList.remove('hidden');out.textContent=e.name==='AbortError'?'Scelta annullata. Nessun download avviato.':'Copia non completata: '+e.message};
    const startIn=()=>{let value=$('#backupLocation').value;return ['downloads','documents','desktop'].includes(value)?{startIn:value}:{}};
    const blob=async()=>{let copy=await fullBackup();return new Blob([JSON.stringify(copy)],{type:'application/json'})};
    const receipt=async(filename,directory,verified)=>{
      let r={filename,directory,verified,at:new Date().toISOString()};
      if(!await change(s=>{s.lastBackup=r.at;s.lastBackupReceipt=r}))throw Error('Copia creata ma stato locale non aggiornato');
      finish(true);
      toast(verified===true?`Percorso autorizzato e salvataggio completato in: ${directory||filename}`:`Salvataggio confermato da te: ${filename}`);
      renderBackupReceipt()
    };

    $('#cancelBackupSave').onclick=()=>finish(false);
    dialog.oncancel=e=>{e.preventDefault();finish(false)};
    if(hasDir){
      $('#browseBackup').onclick=async()=>{
        try{
          folder=await window.showDirectoryPicker({id:'tefinanza-backup',mode:'readwrite',...startIn()});
          folderPermissionConfirmed=false;
          $('#backupDestination').textContent='Cartella selezionata: '+folder.name+'. Conferma il permesso di scrittura per continuare.';
          $('#confirmBackupFolder').disabled=false;
          $('#saveBackupToFolder').disabled=true;
          $('#backupSaveError').classList.add('hidden');
          overwriteName='';$('#backupOverwrite').checked=false;$('#backupOverwriteLabel').classList.add('hidden')
        }catch(e){error(e)}
      };
      $('#confirmBackupFolder').onclick=async()=>{
        if(!folder)return;
        let button=$('#confirmBackupFolder');button.disabled=true;
        try{
          let permission=await folder.requestPermission({mode:'readwrite'});
          if(permission!=='granted')throw Error('Permesso di scrittura non concesso per '+folder.name+'. Scegli un’altra cartella o autorizza l’accesso nel browser.');
          folderPermissionConfirmed=true;
          $('#backupDestination').textContent='Percorso autorizzato: '+folder.name+'. Ora puoi creare e verificare la copia.';
          $('#saveBackupToFolder').disabled=false;
          $('#backupSaveError').classList.add('hidden')
        }catch(e){folderPermissionConfirmed=false;error(e);button.disabled=false}
      };
      $('#saveBackupToFolder').onclick=async()=>{
        let button=$('#saveBackupToFolder');button.disabled=true;
        try{
          if(!folder||!folderPermissionConfirmed)throw Error('Seleziona la cartella e conferma il permesso di scrittura prima di salvare.');
          let permission=await folder.queryPermission({mode:'readwrite'});
          if(permission!=='granted')permission=await folder.requestPermission({mode:'readwrite'});
          if(permission!=='granted')throw Error('Permesso di scrittura non concesso per '+folder.name+'.');
          let filename=C.backupFilename($('#backupOutputName').value),existing=null;
          try{existing=await folder.getFileHandle(filename)}catch(e){if(e.name!=='NotFoundError')throw e}
          if(existing&&(overwriteName!==filename||!$('#backupOverwrite').checked)){overwriteName=filename;$('#backupOverwrite').checked=false;$('#backupOverwriteLabel').classList.remove('hidden');throw Error('Esiste già '+filename+'. Cambia nome o autorizza la sostituzione e conferma di nuovo')}
          $('#backupDestination').textContent='Creazione e verifica della copia in '+folder.name+'…';
          let file=existing||await folder.getFileHandle(filename,{create:true}),data=await blob();
          await C.writeVerifiedBackup(file,data);
          await receipt(filename,folder.name,true)
        }catch(e){error(e);button.disabled=false}
      }
    }
    if(!hasDir&&hasSave)$('#browseBackup').onclick=async()=>{
      let b=$('#browseBackup');
      try{
        let filename=C.backupFilename($('#backupOutputName').value);b.disabled=true;
        let handle=await window.showSaveFilePicker({id:'tefinanza-backup',suggestedName:filename,types:[{description:'Copia TeFinanza JSON',accept:{'application/json':['.json']}}],excludeAcceptAllOption:true,...startIn()});
        await C.writeVerifiedBackup(handle,await blob());
        await receipt(handle.name,'',true)
      }catch(e){error(e);b.disabled=false}
    };
    if(!hasDir&&!hasSave){
      $('#browseBackup').onclick=async()=>{
        let b=$('#browseBackup');b.disabled=true;
        try{
          preparedName=C.backupFilename($('#backupOutputName').value);prepared=new File([await blob()],preparedName,{type:'application/json'});
          $('#backupSystemActions').classList.remove('hidden');
          $('#backupDestination').textContent='Copia pronta: '+preparedName+'. Il file non è ancora salvato: scegli la destinazione tramite il menu di sistema.';
          if(hasShare&&!navigator.canShare({files:[prepared]}))$('#shareBackupFile').hidden=true;
          $('#backupOutputName').disabled=true;b.textContent='Copia preparata'
        }catch(e){error(e);b.disabled=false}
      };
      if(hasShare)$('#shareBackupFile').onclick=async()=>{
        try{await navigator.share({files:[prepared],title:preparedName});$('#backupDestination').textContent='Copia passata al menu di sistema. Salva il file nella cartella scelta, poi torna qui e conferma il salvataggio.'}
        catch(e){error(e)}
      };
      $('#openBackupFile').onclick=()=>{
        if(!prepared)return;
        if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(prepared);
        let tab=window.open(objectURL,'_blank');
        if(!tab)error(Error('Consenti l’apertura della scheda della copia, poi usa File → Salva con nome'));
        else $('#backupDestination').textContent='Copia aperta nella nuova scheda: usa File → Salva con nome, scegli la cartella e il nome '+preparedName+'. Torna qui dopo aver verificato il file.'
      };
      $('#backupManualVerified').onchange=e=>$('#confirmManualBackup').disabled=!e.target.checked;
      $('#confirmManualBackup').onclick=async()=>{
        try{if(!$('#backupManualVerified').checked)return;await receipt(preparedName,$('#backupLocation').value==='other'?'':$('#backupLocation').selectedOptions[0].textContent,false)}
        catch(e){error(e)}
      }
    }
    dialog.showModal()
  })
}
