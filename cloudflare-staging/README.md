# Prova privata Cloudflare — non usare ancora dati personali

Questa directory aggiunge un ambiente separato; i sorgenti originali e `main` non sono modificati. Le tre applicazioni restano distinte. Configurazione effettiva in `deployment.json`.

## Accesso e cifratura

Cloudflare Access consente solo l'identità del proprietario attraverso passkey oppure codice email. Il Worker verifica nuovamente firma RS256, issuer, audience e scadenza del JWT; non si fida del solo header email. Un account diverso non condivide nemmeno lo storage locale. Una pagina rimasta aperta con il vecchio account non può caricare dati nel nuovo account.

L'intero archivio sincronizzato è cifrato nel browser con AES-GCM e chiave casuale a 256 bit, inclusi documenti e metadati. La chiave non viene inviata al server né salvata in localStorage. Rimane temporaneamente nella sessionStorage della scheda, separata per account e app, per un massimo di 15 minuti: consente i ricaricamenti necessari agli aggiornamenti automatici. Blocca sincronizzazione ed Esci eliminano questa copia temporanea; dopo la scadenza o in una nuova sessione occorre sbloccare di nuovo. Conservare la chiave fuori dall'app: il codice email e la passkey autenticano, ma non decifrano la copia cloud. Per Registro Credenziali resta anche il PIN originale, con la cifratura locale già presente. La chiave cloud aggiuntiva protegge i wrapper locali anche contro tentativi offline sul PIN corto.

## Primo uso esclusivamente sintetico

1. Aprire l'URL di prova e accedere con Access. Non importare backup reali.
2. Nel primo dispositivo scegliere **Sblocca sincronizzazione → Crea chiave per il primo dispositivo**. Copiare e conservare la chiave, poi sbloccare.
3. Nel secondo dispositivo inserire la medesima chiave. Se esistono due copie, usare **Copie e ripristino** per scegliere esplicitamente la revisione da verificare e ripristinare. Nessuna unione automatica di copie in conflitto.
4. Dopo lo sblocco, controllo automatico ogni 10 secondi, al ritorno online e quando la pagina torna visibile. Funziona mentre la pagina è aperta: nessuna sincronizzazione in background a browser chiuso. Senza rete le modifiche rimangono nel browser; l'outbox cifrata consente il retry. Non cancellare i dati del browser.

## Integrità e recupero

Snapshot cifrati immutabili in R2; indice delle revisioni e confronto atomico della revisione base in D1. operation_id idempotente: ripetere una richiesta non crea doppioni. Allegati cifrati a blocchi da 1 MB, identificati dall'hash del ciphertext, caricati prima della pubblicazione dell'indice. Tutti i chunk devono esistere nello spazio dell'utente. Un conflitto conserva anche la copia perdente sul server e nel browser. Nessuna cancellazione o pulizia automatica.

Il ripristino verifica gli hash e decifra tutti i documenti prima del cambio; costruisce nuovi database in una generazione separata, poi cambia un solo puntatore locale. La generazione precedente resta recuperabile. Le revisioni passate sono disponibili in **Copie e ripristino**. Recuperare una revisione storica richiede una scelta successiva esplicita prima di pubblicarla come nuova versione. Per precauzione chiudere le altre schede durante i ripristini.

Gli handle delle cartelle locali sono autorizzazioni del dispositivo e non vengono sincronizzati: vanno ricollegati sul dispositivo nuovo. Non trasferire file temporanei di esportazioni in corso: attendere il termine delle operazioni. Nessuna cache Service Worker nella prova, per evitare copie servite dopo un cambio account.

## Backup JSON nativi e migrazione futura

Le funzioni originali rimangono disponibili. Il nuovo dominio non può leggere lo storage del vecchio dominio.

- **TeFinanza:** nel dispositivo originale usare Copia e ripristino per salvare un JSON completo, includendo gli originali. Nel nuovo ambiente il ripristino nativo valida struttura e originali, mostra conteggi e chiede conferma, quindi conserva il punto di sicurezza nella transazione. I JSON incompleti non ricostruiscono i documenti mancanti.
- **Cartella Clinica:** preferire JSON completo o `.tlbackup`. Ripristina mostra il riepilogo prima della conferma e verifica gli allegati. I vecchi JSON possono contenere soli riferimenti ai PDF: recuperarli dal dispositivo originale prima di dichiarare completa la migrazione. Conservare tutti i profili; la sincronizzazione include gli archivi persistenti aperti sul dispositivo, senza mescolarli con altri utenti.
- **Registro Credenziali:** usare Salva copia JSON / Esporta copia e poi Carica backup JSON. Il file nativo contiene password in chiaro: conservarlo protetto e selezionarlo solo nell'app, mai caricarlo su GitHub. L'anteprima originale salta duplicati identici e mantiene voci diverse. Il trasporto cloud cifra l'intero archivio prima di qualsiasi richiesta.

Prima di dati reali: completare test autenticazione su dispositivi effettivi, prove di importazione/esportazione/ripristino e ottenere conferma del proprietario. Conservare intatti browser e backup originali anche dopo il trasferimento. Non dichiarare completa una migrazione senza confronto di conteggi e hash e prova di ripristino in un browser vuoto.

## Sorgenti e distribuzione

Il codice e tutti gli asset originali sono caricati in Workers Static Assets: 52 file per TeFinanza, 80 per Cartella Clinica e 3 per Registro Credenziali. GitHub resta l'archivio del codice e non viene contattato durante l'uso per servire i file dell'app. L'asset binding è accessibile soltanto dopo la verifica JWT; `run_worker_first=true` impedisce di aggirare l'autenticazione chiedendo direttamente un asset. Il deploy controlla che i sorgenti nativi corrispondano al commit `sourceSha`, escludendo soltanto le aggiunte di staging.

`node build.mjs` genera `assets.mjs`. `node worker.test.mjs` esegue i test con SQLite in memoria e fixture sintetiche. Le prove browser locali usano `browser-server.mjs`, vincolato a 127.0.0.1, e Playwright/Chromium. Il server di fixture non è distribuito nel Worker e non contiene credenziali.

La workflow GitHub Actions verifica ogni push sul branch di prova. La fase deploy è predisposta ma richiede la variabile di repository `CLOUDFLARE_STAGING_DEPLOY=true` e il secret `CLOUDFLARE_API_TOKEN` nell'ambiente protetto `cloudflare-staging`. Il token deve limitarsi a Workers, alle tre risorse staging e lettura Access necessaria alla verifica. Il connettore non espone una credenziale trasferibile ad Actions: nessun token è stato copiato in GitHub. La workflow non modifica i servizi operativi e non crea database automaticamente.

## Limiti da collaudare prima dell'attivazione

Metadati cifrati e indici devono rientrare in 8 MB per snapshot. I file sono spezzati in chunk, ma archivi grandi possono incontrare limiti di CPU, subrequest, quota o memoria del browser; testare dimensioni rappresentative. Il ripristino conserva una seconda generazione e richiede spazio locale sufficiente. Il protocollo usa copie intere: i conflitti non vengono fusi campo per campo. I contatori transitori di sincronizzazione clinica e di tentativi PIN locali non sono dati clinici o credenziali: sono normalizzati nella copia trasferita per evitare conflitti al solo accesso. Payload e wrapper crittografici sono preservati. Il controllo frontend è una prova d'integrazione nuova e richiede ancora revisione di sicurezza e collaudo Safari/iPhone/iPad, oltre ai test automatizzati. Email e passkey reali richiedono un accesso interattivo del proprietario, non simulabile con la sua identità dal test.

Rollback: lasciare il branch separato; disabilitare soltanto i nuovi Workers se necessario. Non eliminare D1, R2 o storage del browser. Il rollback del codice non ripristina i dati. Nessuna attivazione definitiva autorizzata in questa fase.
