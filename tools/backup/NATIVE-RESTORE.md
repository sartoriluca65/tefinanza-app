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
