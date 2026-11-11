# TeFinanza

Applicazione web per registrare conti, movimenti, documenti e obiettivi familiari.

**Apri l’app:** https://sartoriluca65.github.io/tefinanza-app/

## Uso

- Non è richiesto un account, nome utente o password.
- I dati vengono salvati nel browser su questo dispositivo. Non vengono inviati a un servizio di sincronizzazione.
- Un nuovo browser parte senza i dati dell’archivio personale del proprietario.
- Per cambiare dispositivo, usa **Copia e ripristino** per esportare e importare il tuo backup. Conserva il backup in un luogo sicuro.
- Il sito personale TeFinanza dell’autore è separato: i dati inseriti qui non sono condivisi con quel sito.

## Codice e aggiornamenti

GitHub Pages pubblica la versione contenuta nel ramo main. Ogni aggiornamento tecnico salvato su questo ramo viene pubblicato automaticamente.

## Manutenzione e distribuzione

La radice di questo repository contiene l’unica copia della versione pubblica. La cartella `dist/` conserva soltanto un rimando per i vecchi collegamenti: le copie identiche di codice, immagini e dipendenze sono state rimosse il 30 ottobre 2026. Il workflow verifica le risorse della radice e tutti i test con `node scripts/check-structure.mjs` e `node --test tests/*.test.cjs`.

Il repository resta necessario per mantenere l’indirizzo GitHub Pages esistente. Il repository privato `tefinanza` conserva la propria configurazione di pubblicazione personale: eliminare questo repository pubblico richiede prima una migrazione dell’hosting che mantenga accesso e dati locali.

La versione 110 allinea app, guida e riferimenti di cache, conserva i miglioramenti per categorie e iPhone e ripara la conferma degli scontrini. Non modifica i nomi dei database, i saldi o i documenti personali.

Il repository privato tefinanza contiene una copia distinta per la pubblicazione personale; GitHub non la aggiorna automaticamente quando cambia questo repository. Le copie sono state allineate il 29 ottobre 2026 e vanno aggiornate insieme per evitare divergenze.

## Allineamento GitHub e Cloudflare

Gli aggiornamenti applicativi devono essere salvati su GitHub e distribuiti sul Worker
`luki-tefinanza-staging`. Il workflow `deploy-cloudflare.yml` pubblica `main` tramite
Wrangler e imposta `SOURCE_SHA` al commit del checkout. Il file `cloudflare/entry.mjs`
espone soltanto il gestore del Worker, lasciando gli export di test nel modulo originale.
Non modificare il codice soltanto dalla dashboard Cloudflare: riportare prima le modifiche
nel repository e distribuire il relativo commit. Il codice non viene sincronizzato
automaticamente da Cloudflare verso GitHub. Database, allegati e archivi personali non
vanno copiati su GitHub. La pubblicazione dell’ambiente Codex è distinta dal deployment.

Per un deployment manuale, dopo i test e la preparazione di `public/` prevista dal workflow:

```sh
npx --yes wrangler@4.160.1 deploy --keep-vars --var "SOURCE_SHA:$(git rev-parse HEAD)"
```

Il valore vuoto di `SOURCE_SHA` nel file di configurazione viene sostituito dal comando
di deployment: il SHA identifica il commit completo, senza riferimenti circolari.

## Affidabilità delle funzioni contabili

Il [contratto del motore e il protocollo di verifica](docs/MOTORE-CONTABILE.md) descrivono
invarianti, aritmetica in centesimi, giornale a contropartite, importazioni atomiche e
limiti della riconciliazione storica. Eseguire `bash scripts/verify-accounting.sh` prima
di pubblicare: include riferimenti Python indipendenti e il ciclo reale nel browser.
I controlli aperti nell'app segnalano totali provvisori; nessun saldo personale viene
corretto automaticamente per ottenere una quadratura apparente.
