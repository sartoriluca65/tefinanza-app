# TeFinanza: preparazione del lettore di ripristino

Solo ramo backup-preparation-2026. Nessuna modifica a main, pubblicazione, workflow di produzione, impostazioni o servizi remoti. Nessun backup reale eseguito o dichiarato riuscito.

## Modifiche e utilizzo futuro

File: `backup-integrity.js`, `app.js`, `index.html`, `tools/backup/native-restore.test.cjs`, questo documento e aggiornamento `E2E-RESULTS.md`.

Nella copia candidata, il comando esistente di esportazione include gli originali e un indice SHA-256 con dimensioni, tipi e collegamenti. Sia il ripristino da file sia l'importazione come testo controllano l'intero elenco prima di scrivere. Il ripristino mantiene il punto di sicurezza precedente e la transazione IndexedDB atomica originale. Un'interruzione non viene annunciata come successo.

I vecchi JSON completi restano leggibili. I nuovi documenti creati intenzionalmente senza originale sono marcati esplicitamente; non si riclassificano automaticamente i documenti preesistenti. Un vecchio documento privo di originale è ambiguo: l'esportazione completa o il ripristino vengono rifiutati. Occorre recuperare e ricollegare l'originale, oppure valutare manualmente una futura procedura: non è recuperabile da byte mai esportati. SHA-256 verifica integrità, non autenticità dell'autore. Nessuna dipendenza aggiunta: Web Crypto e API Blob del browser.

Prima di un futuro uso autorizzato: chiudere le altre schede, usare una copia isolata, esportare in un nuovo file senza sostituire copie valide, verificare l'esito e conservare fuori dal browser il file completo. La prova di ripristino deve usare un profilo nuovo e servizi remoti disabilitati; non basta scaricare un JSON per dichiarare verificato il backup. Un clone Git protegge il codice; non comprende IndexedDB, allegati o dati remoti.

## Prove eseguite

`node --test tools/backup/native-restore.test.cjs`: 7 test superati. Formato precedente completo; originali mancanti/duplicati/scollegati; Base64 e versioni errati; checksum, indice incompleto; testo esplicito; nessuna mutazione della sorgente.

Chromium isolato: JSON v3 completo con confronto dei byte, rifiuto allegato mancante anche nel percorso testo, interruzione della transazione che contiene cancellazione/scrittura degli allegati e verifica che stato persistito, memoria e originale precedenti restino uguali. Nessun servizio operativo contattato. Non provati Safari, file grandi, sincronizzazione cloud o dati reali.

## Rollback e attività manuali

Per il codice: lasciare il ramo non unito. Baseline prima dell'intervento: `9e5c77ef309a308b0c9ccc59cba9489afa0ed268`. Per una futura revisione inversa usare quel commit come riferimento; nessun reset forzato, migrazione o ripristino di dati automatico è previsto. Il formato nativo rimane v3 con campi additivi; i vecchi lettori ignorano l'indice e non ne garantiscono i controlli.

Il rollback del codice non equivale a ripristinare dati. Il recupero di un archivio reale o del punto di sicurezza richiede una distinta autorizzazione e verifica su copia. Chiavi, accessi cloud, Safari/dispositivi e pubblicazione restano attività manuali non eseguite. Prima di distribuire bisogna controllare cache/versioni e connessioni di sincronizzazione nel contesto autorizzato.

## Correzioni successive alla revisione

L'importazione come testo confronta ora gli originali con quelli già salvati. Un conflitto di byte blocca tutta l'operazione; un originale identico non è riscritto. I file mancanti sono aggiunti con `add` nella stessa transazione dei metadati: un ID occupato dopo il controllo annulla tutta l'importazione, mantenendo l'originale dell'altra operazione. Non è introdotta alcuna pulizia automatica.

Il toolkit riconosce i documenti esplicitamente `text-only` con testo anche nelle copie di sicurezza/reset. La conversione dei JSON nativi richiede un indice coerente per le dichiarazioni solo testo e controlla dimensioni, tipi e SHA-256 dei file elencati. I vecchi JSON completi rimangono supportati; documenti ambigui senza originale rimangono rifiutati.

Rifornio nel toolkit condiviso comprende ora il registro di recupero completato. Con registro `pending` l'esportazione fallisce con `RECOVERY_PENDING`, senza scrivere o ripristinare dati. Conservare i dati del sito e completare soltanto un recupero esplicitamente confermato prima di riprovare.

Nuova verifica automatica separata: `.github/workflows/backup-verification.yml`, soli test sintetici con Node 22 e 24, permesso `contents: read`, nessun secret, ambiente di produzione o comando di deploy. Esegue 45 test per versione Node (30 toolkit precedenti, 7 del lettore e 8 regressioni d'integrazione). Il workflow esistente rimane invariato. In locale passano anche i 92 test preesistenti: totale 137. Chromium verifica conflitti, byte identici, collisione sopraggiunta e coerenza dei formati solo testo.

Rollback di questo aggiornamento: riferimento `3e670634a558fd4197231de5112ae13cd9f2e6a3`; preferire lasciare la PR in bozza/non unita. Non tornare ai vecchi esportatori Rifornio durante un recupero pendente. Il merge su main può avviare Pages: richiede autorizzazione separata ed è escluso.

## Recupero dopo azzeramento — 4 novembre 2026

Il JSON nativo mantiene `backupVersion: 3` e aggiunge, quando necessari, `resetBackup.originalFiles` e `resetBackup.originalFileIntegrity`. L'indice della copia precedente copre tutti i suoi documenti; gli originali già inclusi nell'archivio corrente sono riutilizzati senza duplicarne i byte. Anche copie annidate sono controllate, fino a otto livelli: strutture più profonde vengono rifiutate prima di scrivere.

La verifica comprende archivio corrente e copia precedente. Se manca un originale o l'indice non coincide, esportazione e ripristino si fermano. Gli originali di entrambi sono caricati nella stessa transazione IndexedDB. I payload Base64 non rimangono duplicati nello stato persistito: il lettore conserva gli originali nel database file e mantiene i riferimenti necessari all'annullamento.

Il punto di sicurezza del ripristino viene scritto nella stessa transazione di stato e originali; se l'operazione si interrompe, rimangono anche il precedente punto di sicurezza e gli originali precedenti. Il punto di sicurezza separato non è aggiunto al JSON nativo: per copiarlo usare il toolkit, che lo include già.

“Solo testo” viene assegnato nei due percorsi di creazione manuale senza file, non dal salvataggio generale. Prima di annullare un azzeramento o un ripristino, la presenza degli originali è verificata: un allegato mancante non viene trasformato automaticamente in un documento solo testo.

Compatibilità: vecchi JSON completi senza i nuovi campi rimangono accettati, anche con una copia di azzeramento che riusa gli originali correnti. Vecchi JSON che contengono riferimenti senza i relativi byte sono incompleti e vengono rifiutati. Per recuperare gli allegati aggiuntivi della copia di azzeramento serve questo lettore aggiornato; i vecchi lettori non conoscono i nuovi campi e non garantiscono quell'annullamento. Nessuna migrazione o cancellazione automatica.

La conversione del toolbox usa una copia esatta del validatore puro in `tools/backup/finance-originals.js`, necessaria per servire il toolbox senza esporre la radice dell'app. Un test CI controlla che corrisponda byte per byte a `backup-integrity.js`; non esistono due logiche di validazione indipendenti. Non legge storage né effettua richieste.

Prove: 148 test locali passati (56 backup/lettore e 92 regressioni preesistenti), incluse 11 nuove prove su originali del reset, checksum, copie incomplete, originali condivisi, formato precedente, annidamento, conversione e corrispondenza dei validatori. Chromium: azzeramento tramite interfaccia reale, esportazione, ripristino in contesto nuovo, annullamento, byte originali e riapertura; rifiuto di copie incomplete; nessuna apertura del file di destinazione se la copia non è completa; annullamento della transazione con punto di sicurezza precedente invariato; creazione manuale solo testo ancora funzionante. Tutto con dati sintetici e rete esterna bloccata. I test sono inclusi nel workflow di sole verifiche già presente; nessun workflow viene modificato in questo aggiornamento.

Rollback di questo intervento: lasciare la PR #5 in bozza/non unita. Riferimento precedente `11c1f4386efb7f276645ea4eb0f78319dcb1b256`. Dopo un eventuale uso futuro del formato esteso, non tornare a un lettore precedente per recuperarne gli allegati di azzeramento. Il rollback del codice non ripristina i dati. Pubblicazione e accesso a dati reali restano esclusi.
