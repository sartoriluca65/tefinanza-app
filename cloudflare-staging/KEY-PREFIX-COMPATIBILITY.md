# Compatibilità del codice con punteggiatura iniziale

Il controllo locale del proprietario ha rilevato 45 caratteri ricevuti, 44 dopo formattazione, un carattere di punteggiatura iniziale e padding assente. Il decoder corrente rifiuta quel testo prima di leggere il cloud. Non è stata acquisita la chiave né identificato il segno specifico.

Il codice storico del trasporto genera 32 byte casuali in Base64URL senza padding, cioè 43 caratteri. Una fixture con un segno iniziale, spazio e codice storico riproduce lo stesso rifiuto e la stessa forma 45/44. Il segno può essere formattazione estranea; la corrispondenza ai byte originali va provata crittograficamente, mai presunta.

La correzione mantiene il parser rigoroso. Quando rileva un singolo segno di punteggiatura iniziale seguito da esattamente 43 caratteri Base64URL, propone un pulsante esplicito. Non applica conversioni al semplice incolla o al ripristino automatico della sessione. Virgolette, punti elenco, trattini tipografici, segni interni e altri formati restano fuori da questa correzione mirata.

L'azione dedicata verifica il codice candidato contro l'impronta locale esistente e, se presente, decifra la revisione cloud con gli stessi AES-GCM e AAD. Una discordanza o un errore di autenticazione blocca l'attivazione. Senza impronta e senza revisione esistente l'operazione è rifiutata. Nessun dato persistente è modificato prima della verifica; la chiave di sessione viene registrata solo dopo il successo, come nello sblocco normale. Lo sblocco riuscito riprende il flusso di sincronizzazione esistente, che può aggiungere revisioni o copie in conflitto; nessuna revisione cifrata esistente viene riscritta dalla correzione.

Non cambia generatore, KDF, AES-GCM, AAD, namespace, storage originale o backup. La decifratura di verifica usa una chiave candidata locale alla chiamata; un fallimento non sostituisce una chiave già attiva.

## Validazione

- 5 test mirati per app: riproduzione 45/44, rifiuto casi ambigui, blocco senza archivio e su impronta errata, decifratura storica con byte cifrati invariati, rifiuto chiave/AAD/ciphertext errati. Nessuna generazione di chiavi nel percorso di verifica.
- 9 test crypto e 14 backend preesistenti per app passati.
- Test browser locale Chromium desktop/mobile sui sorgenti nativi delle tre app: azione esplicita, nessuna scrittura prima dell'azione, stessa impronta, revisione originale invariata, dati e allegati sintetici trasferiti e riaperti. Chromium con viewport mobile non è Safari iPhone.
- Safari reale Mac/iPhone: da completare. La prova isolata /prova del Worker diagnostico usa solo fixture sintetiche e non accede agli archivi personali.

Distribuzione iniziale limitata alla prova sintetica isolata; nessun deploy sulle tre app operative. Nessuna migrazione irreversibile prevista. Promozione del prodotto separata dal collaudo e non eseguita da questa modifica.
