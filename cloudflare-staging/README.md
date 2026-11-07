# Applicazioni personali Cloudflare — rilascio 2026-11-07.1

Attivazione privata autorizzata dal proprietario il 7 novembre 2026. Codice sul branch cloudflare-live-2026-11-07. I sorgenti originali GitHub e main restano conservati. Il nome storico “staging” negli URL e nelle risorse viene mantenuto per conservare origine del browser, chiavi e archivi. Questi endpoint sono ora operativi: non usarli per future prove distruttive.

## Avvio e accesso
Aprire l'URL in deployment.json e ricaricare una volta. La barra deve indicare ARCHIVIO PERSONALE. Accesso riservato al proprietario con email OTP o provider passkey configurati; email verificata dall'utente, registrazione passkey personale da verificare sul suo dispositivo. Il Worker controlla firma, issuer, audience, scadenza e identità; R2 non pubblico.
Usare la chiave di sincronizzazione ESISTENTE dell'app. Le tre chiavi sono distinte. Non generarne una nuova per un archivio già cifrato. Email, PIN e passkey non ricostruiscono la chiave persa. Conservarla fuori dall'app in un gestore password o in una copia offline protetta.

## Sincronizzazione e conflitti
Controllo ogni 10 secondi, quando la pagina torna visibile e al ritorno della rete, finché la scheda è aperta e la sincronizzazione è sbloccata. Sblocco della scheda massimo 15 minuti; poi occorre reinserire la chiave. Sul secondo dispositivo inserire la stessa chiave; se il confronto segnala un conflitto aprire Copie e ripristino, verificare la revisione più recente e usarla sul dispositivo.
Snapshot e documenti sono cifrati AES-GCM nel browser e separati per utente. Le revisioni sono immutabili. Un conflitto conserva entrambe le copie; non avviene una fusione automatica dei campi. Terminare una modifica e attendere “Sincronizzato” prima di modificare lo stesso dato sull'altro dispositivo.
Senza rete la copia locale rimane disponibile e l'outbox cifrata ritenta. Non cancellare i dati del browser. Non c'è sincronizzazione a browser chiuso né avvio offline garantito: l'accesso iniziale richiede rete e Cloudflare Access.

## Importare backup esistenti
Prima del trasferimento esportare e conservare il backup originale, senza cancellare dati dal vecchio dispositivo.
1. TeFinanza: Copia e ripristino → esportare JSON completo con originali; nella nuova app scegliere ripristino, controllare conti/movimenti/documenti nell'anteprima e confermare. Confrontare conteggi, saldi e apertura documenti.
2. Cartella Clinica: esportare backup completo JSON o tlbackup con PDF. Ripristina → selezionare il file → controllare riepilogo, profili e allegati → confermare. I vecchi JSON con soli riferimenti ai PDF non contengono i documenti: recuperarli dal dispositivo originale.
3. Registro Credenziali: Backup → Carica backup JSON; verificare anteprima, conteggi e duplicati, quindi confermare. Il JSON nativo può contenere password in chiaro: conservarlo protetto, mai inviarlo in chat o GitHub. La copia cloud viene sempre cifrata nel browser.
Importare inizialmente sul solo primo dispositivo, aspettare “Sincronizzato”, poi aprire il secondo e verificare i dati ricevuti. Non importare lo stesso file indipendentemente sui due dispositivi.
Conservare backup periodici oltre alla copia sincronizzata. Verificare un ripristino con una copia protetta in un profilo browser separato, evitando di pubblicare involontariamente dati di prova nell'archivio operativo. Non archiviare backup nei repository.

## Manutenzione e rollback
Cloudflare Workers + D1 + R2 già configurati; database UE, posizione R2 Europa occidentale come hint (non vincolo di giurisdizione). Nessuna cancellazione o migrazione di dati è eseguita dalla promozione. Registro mantiene anche SYNC_SPACE=trial-2026-11-07, così la nuova chiave appena abbinata resta valida.
La workflow cloudflare-live.yml esegue build e test automaticamente. Il deploy CI è predisposto, ma non attivato: richiede variabile CLOUDFLARE_LIVE_DEPLOY=true, secret CLOUDFLARE_API_TOKEN nell'ambiente protetto cloudflare-live e relativi permessi limitati. Il connettore non espone un token trasferibile ad Actions. Questa distribuzione è eseguita con il connettore già autorizzato. Non abilitare la vecchia workflow staging contro queste risorse operative.
Per aggiornamenti futuri usare risorse di collaudo distinte, poi un rilascio verificato dal branch live. Per rollback ridistribuire codice e asset del commit precedente conservando identici APP, SYNC_SPACE, origine, D1, R2 e identità Access. Non cambiare chiavi e non ripristinare automaticamente revisioni dati.

## Verifiche e limiti dichiarati
14 test backend e 9 crypto superati. Chromium e WebKit con profili persistenti: backup/import/export/ripristino delle tre app, PDF sintetici, trasferimento e riapertura fra due browser, ricezione automatica. WebKit, Firefox e Chromium: prima chiave, sblocco vecchia chiave, vecchio ciphertext, rifiuto chiave errata e cache non leggibile conservata. Interfaccia operativa verificata per tutte le app.
WebKit Linux non equivale a Safari su macOS/iOS; non è stato eseguito un audit di sicurezza indipendente. Le verifiche sui dispositivi personali effettuate dall'utente restano parte del collaudo effettivo. OCR e ogni variante di stampa non sono stati collaudati integralmente.
TeFinanza ha due test preesistenti falliti: riconoscimento della voce “Carta igienica” fra i prodotti dello scontrino, e confronto testuale di una copia del validatore backup negli strumenti di laboratorio. Il percorso nativo backup completo/ripristino è passato nei browser, e 7 test del ripristino nativo passano; i due difetti non vengono dichiarati risolti.
Metadati dello snapshot massimo 8 MB; documenti in blocchi da 1 MB. Provare archivi grandi per gradi e controllare quota Cloudflare e spazio browser. Nessun dato reale è importato dall'assistente.


## Aggiornamento OCR 2026-11-07.2
La classificazione dei prodotti che iniziano con CARTA è corretta; la suite nativa standard ora passa integralmente. Vedere OCR-FIX.md. La nota sul difetto OCR nel collaudo iniziale è storica; resta la differenza fra copie del validatore negli strumenti di laboratorio.
