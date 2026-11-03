# Backup e ripristino isolato — fase 0B

Preparazione separata dall'app. Nessun file applicativo, workflow, dominio o
configurazione è cambiato. Nessun avvio automatico, chiamata di rete, raccolta di
sessioni/token o scrittura negli archivi applicativi.

## Ambito e limiti

Il formato aggiuntivo `luki-isolated-backup` v1 conserva le stringhe originali di
localStorage e i record dei database consentiti, inclusi Blob/byte. SHA-256 copre
l'intero contenuto serializzato; i riferimenti ai documenti sono controllati.
L'hash rileva alterazioni accidentali, non autentica l'autore. Non è cifrato:
questa fase usa esclusivamente dati sintetici. Limite prudenziale: 64 MiB del
pacchetto JSON serializzato, minore per i binari codificati Base64. Non suddividere
o eliminare allegati per aggirare il limite: fermarsi e usare un flusso streaming
completo da validare in una fase successiva.

`prepareRestore()` produce un piano; `restoreToNewSandbox()` lo inserisce soltanto
in un NUOVO database `backup-preparation-*` su loopback. Non ripristina nei
database dell'app e non rende i dati immediatamente utilizzabili nell'app. La
riapertura nelle app originali richiede una successiva prova di integrazione e
autorizzazione; non è certificata dai test del formato.

Non sono esportati autenticazione, chiavi API, CryptoKey memorizzate, permessi
di cartelle, dati remoti o log di produzione. L'assenza di un originale atteso
blocca il pacchetto: nessun recupero cloud automatico. Chiudere le altre schede
del laboratorio durante una cattura: due letture uguali rilevano molti cambiamenti,
ma non costituiscono una transazione globale fra localStorage e IndexedDB.

## Prova riproducibile con dati inventati

Richiede Node.js 22+ e Python 3.11+. Dalla radice del repository:

```sh
node tools/backup/backup.test.mjs
node tools/backup/legacy.test.mjs
node tools/backup/offline.test.mjs
node tools/backup/make-fixture.mjs PROFILO /tmp/esempio-sintetico.json
node tools/backup/offline.mjs verify PROFILO /tmp/esempio-sintetico.json
node tools/backup/offline.mjs stage PROFILO /tmp/esempio-sintetico.json /tmp/ripristino-sintetico-nuovo
```

Sostituire PROFILO con una chiave esportata da `repository.mjs`. Usare destinazioni
nuove: i file e le directory esistenti vengono rifiutati, mai sostituiti.
La cartella di staging contiene il pacchetto e `VERIFIED.json`, scritto per ultimo
dopo rilettura. Una cartella interrotta senza ricevuta non è una copia verificata;
non viene cancellata né riutilizzata automaticamente.

Per l'interfaccia locale, servire ESCLUSIVAMENTE la cartella degli strumenti:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory tools/backup
```

Aprire `http://127.0.0.1:8765/lab.html`. La pagina crea esempi sintetici, verifica
il file riselezionato e prova l'importazione in un nuovo spazio di laboratorio.
La politica della pagina vieta connessioni applicative. Non servire né avviare
le app originali: potrebbero migrare dati o inviare statistiche all'apertura.

Test browser facoltativo: `python3 tools/backup/browser_test.py`, con Playwright e
Chromium installati. Usa un nuovo contesto temporaneo e blocca le richieste esterne.
Playwright è una dipendenza di test, non dell'app; non modifica i requisiti di produzione.

## API di esportazione, senza esecuzione automatica

`capture(spec, source)` legge due volte soltanto le chiavi e i database nella
specifica. `browserSource(window)` deve essere costruito esplicitamente da un
operatore. In questa fase usarlo esclusivamente con archivi sintetici nel browser
di laboratorio. Non incollare comandi nei browser personali e non avviare catture
su produzione: questi accessi richiedono una nuova autorizzazione.

`downloadBackup` restituisce `DOWNLOAD_REQUESTED_NOT_VERIFIED`. La selezione o
condivisione di una destinazione non viene presentata come conferma del contenuto.
La verifica indipendente avviene rileggendo il file realmente conservato.

## Formati precedenti

Le app e i loro lettori precedenti restano invariati. `legacy.mjs` accetta COPIE
JSON native di Diviso, Cochi non cifrato, Rifornio schema 1 e TeFinanza v3. Non
sovrascrive né migra alcun archivio. Un vecchio JSON Rifornio non può recuperare
viaggi mai inclusi e viene marcato `LEGACY_VEHICLES_AND_REFUELS_ONLY`.

Per Cochi cifrato, ZIP AutoControl, formati clinici `.tlbackup`, `.tlenc`, ZIP e
vecchi JSON, usare il lettore originale in una futura copia isolata e senza rete:
il nuovo strumento non pretende di decifrare o convertire questi formati. Gli ZIP
PNG di Stickers non contengono tutti i metadati e non sono trattati come copie
complete. Non usare password reali nei test e non trasmetterle nei log o in chat.

## Rischi residui, ripristino e rollback

Nessun test su dati personali, servizi reali, iPhone o Safari. I test verificano
integrità, completezza dei riferimenti, conservazione dei byte, rifiuto dei file
danneggiati e destinazioni già esistenti, compatibilità dichiarata e interruzioni.
Non certificano la validità clinica/contabile, la decodifica delle immagini o
l'accessibilità di tutti i servizi. Un allegato atteso ma assente fa fallire anche
un archivio con record solo testuali: serve una successiva classificazione esplicita,
mai una scelta automatica che possa nascondere documenti mancanti.

Rollback della preparazione: non unire il ramo. Tutti i file sono aggiuntivi e
nessun codice d'avvio li importa. Per annullare in futuro un'integrazione, rimuovere
solo il riferimento agli strumenti dopo revisione; non cancellare chiavi, database,
backup o ricevute. I sandbox falliti rimangono separati e non sono eliminati
automaticamente. Non ripristinare il codice come sostituto del recupero dei dati.

## Copertura di questo repository

TeFinanza: include stato corrente, restoreSafety e tutti gli originali in files. Le informazioni di reset contenute nello stato sono preservate. Sono esclusi cloudSync, chiave quotazioni e handle della cartella automatica: le autorizzazioni devono essere concesse nuovamente. Il backend /api/sync non viene interrogato. La concorrenza delle schede dell’app rimane da correggere.

## Prove sulle copie applicative

Vedi [E2E-RESULTS.md](E2E-RESULTS.md) per i casi effettivamente provati, le incompatibilità native ancora aperte e i limiti del recupero operativo. Gli strumenti rimangono separati dall’app pubblicata.
