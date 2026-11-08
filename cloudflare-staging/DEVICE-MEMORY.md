# Chiave ricordata per dispositivo — 8 novembre 2026

## Problema verificato nel codice pubblicato

La chiave di sincronizzazione veniva salvata in sessionStorage con scadenza di
15 minuti; tick la eliminava dalla RAM e dalla sessione a scadenza. Inoltre
pagehide impostava stopped senza un ripristino simmetrico al ritorno della
pagina. Non è un limite di Cloudflare: sono comportamenti del trasporto client.

## Comportamento corretto

Dopo la verifica della chiave contro il fingerprint locale e l'eventuale copia
cloud AES-GCM, si salva un CryptoKey AES-GCM a 256 bit non esportabile nel database
IndexedDB nativo del trasporto. Il record è separato per app, account e origin;
SYNC_SPACE continua a essere parte dell'identità calcolata dal Worker. Non si
memorizzano chiave raw o password in localStorage. Una verifica cifrata locale
conferma il read-back del CryptoKey serializzato dal browser.

Alla riapertura e al ritorno da pagehide/pageshow la sessione Access viene prima
verificata. Solo dopo si rilegge la credenziale locale e si riprende il normale
trasporto. Errori di rete non eliminano la credenziale; una sessione scaduta o
un altro account bloccano l'accesso senza cancellare i dati. Passkey/email e PIN
del Registro restano protezioni distinte, con le loro regole preesistenti.

Il nuovo comando Scollega questo dispositivo invalida gli sblocchi precedenti,
rimuove solo il record della credenziale e avvisa le altre schede tramite il
controllo di revisione locale. Non modifica snapshot, allegati, pending, revisioni
cloud o dati dell'app. Un'altra app, account o browser non può riusare quel record.

Le vecchie sessioni raw ancora presenti sono migrate una volta, solo dopo aver
verificato il fingerprint e soltanto su un dispositivo non esplicitamente
scollegato. La copia raw viene rimossa solo dopo il salvataggio riuscito del
CryptoKey. Una sessione legacy non può annullare uno scollegamento esplicito.
Se la vecchia versione ha già eliminato la chiave scaduta, occorre inserire una
volta la STESSA chiave esistente: non viene ricostruita né rigenerata.

Nessuna chiave nuova viene generata dalla ripresa. Non cambiano formati di
chiave/ciphertext, AAD, fingerprint, database cloud, namespace, algoritmo o IV.
La memorizzazione locale dipende dalla conservazione dei dati del browser: la
chiave esterna resta necessaria per collegare un altro dispositivo o dopo la
cancellazione dei dati di Safari. Il browser deve essere aperto per eseguire
il trasferimento; alla riapertura si riprende senza reinserire la chiave.

## Sorgenti e pubblicazione

Il controller è riallineato ai controlli grafici e alle diagnostiche effettivamente
pubblicati, per non rimuovere correzioni di lavori precedenti. Il Worker, bootstrap,
crypto, deployment.json e schema.sql sono invariati. build.mjs concatena il nuovo
modulo device-key.mjs e rimuove l'hook di test prima di creare assets.mjs.

Questo ramo non è cloudflare-live-2026-11-07: nessun deploy produzione viene
innescato dal suo push. La pubblicazione agli URL personali richiede conferma
esplicita come richiesto dall'utente. Prima dell'applicazione va ricontrollato
che non ci siano altre modifiche pubblicate nel frattempo; si aggiornano solo
controller/assets mantenendo binding, Worker e risorse esistenti.

## Verifiche completate

Su tutte e tre le app:

- 5 test della credenziale: salvataggio e rilettura, non esportabilità, isolamento,
  revoca, invalidazione di un salvataggio iniziato prima dello scollegamento.
- 14 test backend e 9 crypto preesistenti: passati senza cambiare quei sorgenti.
- WebKit desktop e profilo iPhone con browser persistenti sintetici separati:
  un giorno simulato, chiusura e riavvio del processo browser, scambio bidirezionale,
  allegato sintetico, pagehide/pageshow, navigazione avanti/indietro, rete offline,
  login scaduto e riapertura senza chiave, cambio account, scollegamento da un'altra
  scheda, sessione legacy scaduta valida e blocco delle sessioni legacy revocate.
- Lo snapshot esportato non include credenziali del dispositivo o chiave raw.

Comandi (Node 24 e Playwright WebKit installato):

```
node cloudflare-staging/build.mjs
node cloudflare-staging/device-key.test.mjs
node cloudflare-staging/worker.test.mjs
node cloudflare-staging/crypto.test.mjs
node cloudflare-staging/device-memory-browser.cjs
```

I test usano HTTP locale, SQLite in memoria e R2 simulato, mai dati o sessioni
personali. WebKit Linux e il profilo iPhone non sostituiscono Safari Apple fisico.
Il test browser usa LUKI_TEST_PORT (default 18766) e crea solo profili sintetici
in /tmp. Gli hook LukiSyncTest del server di prova non sono nella build pubblicata.
