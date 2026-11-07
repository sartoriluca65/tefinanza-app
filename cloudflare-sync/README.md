# Correzione sincronizzazione Cloudflare — ambiente di prova

Questa cartella contiene il trasporto introdotto dalla migrazione Cloudflare.
Le applicazioni GitHub Pages precedenti non richiedevano questa chiave di
sincronizzazione. Il PIN del Registro e le password dei backup sono protezioni
separate: non vengono modificati.

## Risultato dell'analisi

La chiave Cloudflare è costituita da 32 byte AES-GCM casuali, non da una password.
Il formato storico resta Base64URL senza padding, 43 caratteri; sono accettate
anche Base64 standard e la forma con padding corretto. Fingerprint SHA-256, AAD,
IV di 12 byte e formato ciphertext v1 restano invariati.

Il decoder precedente usava Base64URL correttamente, ma eliminava solo whitespace
ASCII interno: un NBSP o separatore invisibile incollato da Note causava l'errore.
Sono ora rimossi esclusivamente whitespace Unicode, U+200B e U+2060; nessuna
sostituzione di lettere o punteggiatura. Decodifica e padding sono condivisi fra
browser e Worker, così il codice generato non può divergere dai sorgenti testati.

Nel caso documentato dall'utente, il valore incollato aveva 37 caratteri: era
incompleto e non può essere riparato aggiungendo padding. Non è stato dimostrato
un generatore che produca 37 caratteri. Il generatore corrente è verificato con
roundtrip di byte e lunghezza; se la verifica fallisce non prosegue. Una chiave
completa esistente è utilizzabile senza conversione crittografica o migrazione.
La recuperabilità di una chiave individuale si verifica solo localmente tramite
formato, fingerprint e decifratura autenticata. Il server non conserva la chiave
segreta: una chiave persa si recupera da una copia completa o sessione valida,
non dal ciphertext. Non inviare chiavi reali nei log o nelle issue.

## Prima configurazione sicura

1. Accedere con lo stesso account Cloudflare Access su Mac e iPhone.
2. Nel primo dispositivo scegliere Crea chiave per il primo dispositivo.
3. Usare Copia chiave o Salva chiave in un file, conservarla al sicuro e reincollarla
   dalla copia salvata nel campo Conferma chiave salvata.
4. Premere Sblocca con questa chiave. Solo dopo il confronto della chiave salvata
   viene inizializzata l'associazione atomica e consentito il primo upload.
5. Sul secondo dispositivo inserire la stessa chiave in Sblocca sincronizzazione.
   Se il dispositivo ha già dati propri, scegliere esplicitamente la revisione
   in Copie e ripristino. Le copie differenti diventano conflitti conservati.

Non avviene alcuna generazione automatica all'avvio. Una chiave appena generata
ma non confermata viene mantenuta solo nella sessionStorage della stessa scheda,
così un nuovo clic ripropone la stessa candidata. Non è una copia di sicurezza:
chiudere la scheda può perderla. La chiave sbloccata ha la scadenza di 15 minuti
preesistente. Recupera chiave da questa scheda verifica scadenza e fingerprint.
Nessuna chiave in localStorage né inviata al server. Il server conserva solo il
fingerprint per impedire a due prime inizializzazioni concorrenti di associare
chiavi differenti. Le copie legacy senza fingerprint continuano a funzionare:
non sono riscritte. La tabella sync_keys è additiva, senza DROP o DELETE.

Quando esiste una copia cifrata, o una chiave già associata, la creazione di una
nuova chiave è bloccata. Nessun reset o sovrascrittura automatica è disponibile.
I conflitti creano copie immutabili senza rimpiazzare la revisione principale.

## Sorgenti, configurazione e produzione

I Worker storici con nome -staging sono attualmente configurati private-live.
Non vengono modificati da questa correzione. Le risorse in test-deployment.json
sono nuove e separate: Worker -keyfix-test, D1, R2 e app Access dedicati. Gli IdP
passkey/email e la policy solo proprietario sono riusati senza modificare quelli
esistenti. Nessuna modifica a main, Pages o produzione: usare il ramo fix e PR.

Negli ambienti di prova i file statici pubblici dell'app sono letti dal commit
immutabile indicato in test-deployment.json, dopo verifica del JWT Access.
Non vengono inoltrati cookie, chiavi o header di identità a GitHub. Questo
permette di provare le app senza riusare i binding ASSETS della produzione.
Per una futura promozione produzione si potranno usare i normali static assets;
richiede una revisione separata e conferma esplicita.

build.mjs genera assets.mjs da crypto.mjs, controller.js e bootstrap.js;
assets.mjs è ignorato da Git. deploy-test.mjs rifiuta nomi diversi da -keyfix-test
e modalità diversa da staging. Le credenziali API restano nel gestore segreti,
mai nel repository. Nessuna pipeline fa deploy produzione al merge.

## Verifiche riproducibili (Node 24)

```
npm install
npm run build
npm run lint
npm test
npx playwright install --with-deps webkit
npm run test:browser
```

I test unitari coprono tutte e tre le app, 256 vettori fissi di codifica per app,
chiavi sintetiche generate, Base64 standard/URL e padding, copia/incolla Unicode,
chiavi incomplete e caratteri estranei, compatibilità ciphertext vecchio/nuovo,
AES-GCM con AAD errato, inizializzazione concorrente, conflitti, replay, copie
legacy e JWT RSA firmati/scaduti/audience errata. Il backend usa SQLite reale in
memoria e la funzione api del Worker, con un R2 simulato senza dati reali.

Il test WebKit usa profili desktop e iPhone 13, UI e trasporto effettivi, due
profili persistenti separati (WebKit Linux non salva Blob negli IndexedDB dei
profili effimeri). Verifica chiavi invalide senza scritture, conferma da copia
salvata, download, copia (clipboard OS simulata), recupero sessione, blocco nuova
chiave con cloud esistente, allegati Blob cifrati, Mac → iPhone → Mac e conflitti
simultanei. Le app originali vengono caricate per uno smoke test dei loro file:
il Registro mantiene il proprio PIN gate. Non è una simulazione di passkey reali.
Per smoke test di tutti i repository usare SYNC_REPOS_ROOT; senza quel parametro
viene verificata l'app del repository corrente. SYNC_TEST_APP limita il ciclo.

WebKit Linux e profilo iPhone non equivalgono a Safari Apple su dispositivi fisici.
La prova autenticata degli URL nuovi va completata dal proprietario; nessun
accesso personale o bypass dell'autenticazione viene usato nei test automatici.

## Prova Mac/iPhone

Usare l'URL di test riportato in test-deployment.json su entrambi. Creare una
chiave soltanto se lo spazio è vuoto, conservarne l'intero contenuto, collegare
il secondo dispositivo con la stessa chiave. Modificare un record sintetico sul
Mac, attendere la revisione sincronizzata, verificare sull'iPhone senza campi in
modifica e poi fare il percorso inverso. Per due modifiche simultanee verificare
Copie e ripristino: devono essere conservate entrambe e la scelta è esplicita.
Non importare backup o dati personali negli ambienti di prova.
