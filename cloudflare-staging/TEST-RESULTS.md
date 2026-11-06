# Collaudo del 6 novembre 2026

Stato: implementazione di prova, non attivata per dati personali. Nessun backup reale importato. Branch `cloudflare-staging-2026-11-06` nei tre repository originali; `main` non modificato.

## Nuovo trasporto

Node 24.22.1, SQLite in memoria, R2 simulato: **13 test superati**. Coprono AES-GCM (chiave errata, ciphertext alterato, account/app errati), rifiuto di payload in chiaro, limite body, idempotenza, separazione utenti, modifiche simultanee, conservazione conflitti e revisioni, allegati mancanti/corrotti o appartenenti ad altro utente, CSRF, interruzione R2, Worker senza autenticazione, verifica JWT e cambio account con pagina rimasta aperta.

Chromium locale, Playwright e server vincolato a loopback: **6 scenari del trasporto superati**. Archivi IndexedDB e impostazioni acquisiti e cifrati; ripristino sul secondo dispositivo con originali byte per byte; nessun ciclo di revisioni causato dalla ricifratura degli stessi allegati; conflitti conservati; separazione remota e locale di utenti diversi; cambio account nello stesso browser.

**3 prove di avvio native superate:** sorgenti originali di TeFinanza, Cartella Clinica e Registro Credenziali con lo storage isolato. Rete applicativa esterna bloccata durante le prove locali. Il collaudo finale usa checkout completi; OCR, stampe e tutti i casi del motore PDF non sono stati verificati integralmente.

**3 round trip nativi tra due browser superati:** conti sintetici TeFinanza; paziente e PDF sintetici Cartella Clinica; credenziale sintetica Registro. Riapertura e verifica dei dati/byte. Nei payload cloud simulati non compaiono i valori in chiaro né la chiave di sincronizzazione. Per Registro rimane anche la cifratura locale precedente.

**3 prove native di backup superate:**

- TeFinanza: creazione JSON completo, validazione, conferma/ripristino, punto di sicurezza precedente; JSON corrotto senza mutazioni.
- Cartella Clinica: JSON completo con PDF, anteprima, ripristino, copia precedente e rifiuto hash alterato.
- Registro Credenziali: importazione JSON attraverso il dialogo originale, anteprima senza password visibili, persistenza locale cifrata, esportazione e riconoscimento dei duplicati.

**3 prove di ricezione automatica native superate:** dopo l’abbinamento iniziale, gli aggiornamenti arrivano al secondo browser inattivo in tutte le tre app; il solo sblocco PIN non genera un falso conflitto.

Una prova aggiuntiva con due utenti nella stessa origine e nello stesso browser verifica anche l’indipendenza dei blocchi di modifica clinici. La ricezione automatica ripetuta è verificata senza reinserire la chiave durante i 15 minuti di sblocco della scheda.

## Runtime Cloudflare reale

Un Worker diagnostico temporaneo, protetto da una chiave casuale e poi rimosso, ha verificato sul runtime Cloudflare: firma JWT sintetica valida, recupero delle chiavi pubbliche Access e importazione RSA, e per ciascuna app scrittura/lettura D1, upload/download R2 con hash identico, retry idempotente e conservazione di una copia concorrente. Tutte le verifiche sono passate. Le copie di prova sono in namespace sintetici distinti dal proprietario; non sono state usate credenziali o sessioni personali. I dati sintetici delle prove sono conservati nelle risorse staging.

## Codice preesistente

TeFinanza: **146/148 test passati**; due fallimenti già presenti prima dell'intervento (riconoscimento prodotto nello scontrino e copia del validatore backup non identica). Non modificati per questa migrazione. La workflow preesistente di TeFinanza fallisce anche sul branch; il nuovo trasporto ha una workflow distinta.

Cartella Clinica: **12 gruppi di regressione e controlli cartella superati**, inclusi JSON/archivio con allegati e misurazioni. Non equivale a collaudo su iPhone/iPad/Safari.

## Cloudflare e GitHub

Creati soltanto tre nuovi Workers staging, tre D1 dedicati in giurisdizione UE e tre bucket R2 dedicati con indicazione di posizione Europa occidentale. La posizione R2 indicata è un hint, non un vincolo di giurisdizione UE. Nessun riutilizzo o modifica di `aifusion-db` e degli altri cinque Workers preesistenti.

Cloudflare Access configurato con policy riutilizzabile limitata al proprietario, provider email OTP e passkey. Il Worker verifica nuovamente il JWT. Bindings e configurazioni letti dopo il deploy. `workers.dev` attivo sui soli nuovi Workers; preview aggiuntive disabilitate. Dominio pubblico r2.dev disabilitato sui tre bucket. Nessuna cancellazione automatica.

Il fetch esterno del connettore è limitato ai suoi domini autorizzati. Il controllo HTTPS dall’ambiente di esecuzione con rete autorizzata ha invece verificato nove redirect 302 verso Cloudflare Access: pagina, asset e API per ciascuna applicazione. Il controllo struttura completo di TeFinanza è passato (89 file, 53 script, 31 riferimenti locali). Restano necessari apertura interattiva del proprietario, verifica email reale, registrazione/utilizzo passkey e test su dispositivi reali. Non sono stati inviati codici email dal test né registrate passkey a nome dell’utente. Il proprietario ha eseguito il percorso email e segnalato un errore interno all’apertura nella prima distribuzione; è stata distribuita la versione con Static Assets e riferimenti diagnostici, ancora da confermare interattivamente.

GitHub Actions: fase di test del nuovo trasporto passata nei tre repository. Deploy automatico predisposto ma non abilitato: serve una credenziale CI dedicata e protetta, non esposta dal connettore. Le distribuzioni staging iniziali sono state eseguite tramite il connettore Cloudflare autorizzato.

## Prima di usare dati reali

Verificare login, isolamento end-to-end, prestazioni e limiti con dimensioni rappresentative; revisione di sicurezza del nuovo trasporto; prove Safari/iPhone/iPad; confronto conteggi e hash dei backup sintetici; attivazione CI protetta. Gli asset sono ora ospitati interamente in Workers Static Assets e passano sempre dal Worker autenticato. Ottenere infine la conferma dell'utente prima di importare dati reali o attivare definitivamente le nuove versioni.


## Correzione dialoghi di sincronizzazione

I messaggi di errore erano visualizzati nella barra dietro al dialogo modale e potevano far sembrare inattivi i pulsanti. Ora gli esiti sono visibili anche dentro al dialogo; ogni pulsante mostra l’attesa e impedisce clic ripetuti. La scelta di una revisione a sincronizzazione bloccata indica come sbloccare e offre un accesso diretto alla finestra della chiave. Nessuna modifica a cifratura, dati, chiavi o revisioni.

Verifica con pulsanti reali in Chromium: errore chiave visibile e pulsante riattivato; generazione chiave con indicazione visibile; sblocco valido; revisione bloccata con istruzioni; passaggio diretto allo sblocco e ripristino verificato a larghezza mobile. Tutto con identità e archivi sintetici. Il test non sostituisce la verifica su Safari reale.
