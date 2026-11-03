# Aggiornamento dopo revisione — 3 novembre 2026

Tre difetti residui corretti nei candidati: conflitti degli originali nell'importazione testo TeFinanza; registro Rifornio omesso dal toolkit dopo un'interruzione; documenti solo testo riconosciuti dal lettore ma non dal toolkit. Nuovo workflow separato di soli test sintetici, senza modifiche al workflow di produzione.

Prove locali: 137 test TeFinanza (45 backup/lettori + 92 precedenti), 48 portale e quattro percorsi Chromium superati. Zero richieste esterne eseguite nei browser di prova. Comandi, limiti e rollback in [NATIVE-RESTORE.md](NATIVE-RESTORE.md). Le prove precedenti qui sotto rimangono storiche, con conteggi riferiti a quella fase. Nessun backup reale eseguito, nessun merge o deploy.

---

# Aggiornamento: correzioni dei lettori nativi — 3 novembre 2026

Le tre anomalie descritte nel rapporto storico qui sotto sono state corrette SOLO nei candidati del ramo `backup-preparation-2026` (TeFinanza e portale). Le copie pubblicate non sono aggiornate. Rifornio archiviato ha soltanto una proposta locale.

Nuove prove sintetiche: quattro percorsi Chromium superati, inclusi errori di scrittura e riapertura; 14 test Node sui due repository. Rifornio locale: ulteriori 6 test dello stesso componente. Nessuna richiesta eseguita verso servizi applicativi di produzione. Dettagli, limiti e rollback: [NATIVE-RESTORE.md](NATIVE-RESTORE.md).

---

Rapporto storico precedente alle correzioni:

# Risultati di integrazione su copie — 3 novembre 2026

Dati esclusivamente sintetici, contesti Chromium nuovi e servizi esterni bloccati. Nessun archivio personale, browser esistente o database operativo utilizzato. Applicazioni originali non modificate.

I test eseguono i sorgenti applicativi del commit `d2bc729a695de8b468597d411b632596e7d13381` (per il repository iOS soltanto verifica statica dello schema, non esecuzione).

| Copia applicativa | Nuovo toolkit: apertura e riapertura | Diagnostica dei lettori nativi |
|---|---|---|
| TeFinanza | PASS | native_missing_attachment_preserves_valid_archive |

Flusso: archivio inventato aperto nell’app; cattura in sola lettura; controllo del pacchetto; scrittura tramite adattatore SOLO di test in un secondo contesto vuoto su loopback; apertura e ricarica della copia originale dell’app; confronto di dati e allegati. Nessun importatore operativo viene aggiunto all’app.

## Esiti da non confondere

- TeFinanza: un JSON nativo con metadati del documento ma senza originalFiles viene accettato e rimuove il file originale nella destinazione di prova. Il nuovo toolkit rifiuta l’allegato mancante. Il lettore nativo resta invariato.

## Controlli affinati nel nuovo toolkit

Rifiuto di veicoli senza nome, regole Cochi incompatibili con il lettore, anagrafica clinica mancante e riferimenti file clinici non validi. Fixture aggiornate per rispettare gli schemi delle app. Per iOS, UUID controllati prima di produrre una copia. Non sono introdotte migrazioni o cancellazioni.

Test del toolkit: 30 test JavaScript per copia (23 core, 4 compatibilità, 3 staging). Tutti passati. SHA-256 e confronto dei byte non sostituiscono i controlli applicativi sopra distinti.

## Limiti e rollback

Nessuna garanzia su servizi remoti, account operativi, Safari, OCR, disponibilità delle email o ripristino di file oltre il limite prudenziale di 64 MiB. Le condizioni native pericolose sopra indicate sono blocchi all’uso operativo del relativo lettore: non interpretare PASS del toolkit come correzione dell’app.

Rollback: lasciare il ramo non unito. Sono cambiati soltanto strumenti/test/documentazione sotto tools/backup; nessun avvio applicativo li importa. Per tornare alla prima preparazione, selezionare il commit precedente sul ramo dopo revisione; non ripristinare database, cancellare chiavi o migrare dati. Le copie valide sono conservate e le destinazioni esistenti vengono rifiutate.

