# Contratto del motore contabile e verifiche indipendenti

## Ambito

Il motore gestisce importi in EUR, conti correnti, liquidità dei dossier, wallet, carte/passività e posizioni finanziarie. Le quantità e i prezzi unitari non sono importi monetari e conservano i loro decimali; i controvalori ufficiali e le commissioni sono registrati in centesimi. La correttezza del motore su dati controllati è distinta dalla riconciliazione dell'archivio storico con documenti bancari.

Non sono previste correzioni automatiche dei saldi iniziali, cancellazioni di dati storici, contropartite inventate o migrazioni dei servizi cloud. Le conferme memorizzate non sono certificazioni bancarie.

## Invarianti obbligatori

- Gli importi monetari devono essere rappresentabili in centesimi esatti. Si usano BigInt per somme e confronti; arrotondamento decimale half-up simmetrico per controvalori derivati. Lo zero negativo è normalizzato.
- Un trasferimento interno ha due gambe, su conti diversi, dello stesso evento/data, di importi opposti e non nulli. Una commissione dichiarata ha una sola registrazione separata, sul conto di origine. Un trasferimento in date diverse passa per un conto transitorio esplicito.
- Le commissioni di investimento devono riferirsi a una compravendita esistente, avere data/conto/importo coerenti e comparire una sola volta.
- Un rimborso di acquisto riduce la spesa originale, non genera reddito. Deve riferirsi a una spesa precedente della medesima categoria, e il totale dei rimborsi non può eccedere la spesa. Il cashback esterno non collegato è un'entrata distinta. Il rimborso di una commissione richiede la correzione dell'evento associato, non un rimborso generico.
- Le compravendite nuove o modificate richiedono titolo, quantità, prezzo e commissione esplicita (anche zero); il conto corrente regola la cassa e il dossier registra la quantità. L'importazione non inventa quantità o prezzi mancanti. Il netto e il lordo sono dichiarati esplicitamente.
- `bookCost` è il costo residuo autoritativo, in centesimi. L'acquisto capitalizza la commissione nel costo del titolo; le vendite allocano il costo in modo deterministico e l'ultima vendita scarica tutto il residuo. Il costo medio unitario è una rappresentazione, non la fonte per ricalcolare indefinitamente il capitale.
- Una vendita eccedente la quantità disponibile, anche di una frazione minima, è rifiutata. Modifica e cancellazione ripristinano lo snapshot prima di riapplicare l'evento. Operazioni successive impediscono modifiche retroattive non sicure.
- La consistenza finale deve coincidere con la sequenza delle operazioni applicate. Quantità e costo di una posizione con operazioni collegate non si sovrascrivono direttamente dal modulo posizioni.
- Un tentativo fallito non modifica l'input, il record IndexedDB o gli allegati. Il salvataggio nell'app utilizza la transazione IndexedDB esistente per stato e originali.

## Basi di calcolo

`accountLedgerBalance()` è la base comune per saldi e conferme: conti bancari e liquidità titoli usano movimenti effettivi; carte e wallet includono soltanto le contropartite informative non ambigue già previste dal modello. Le viste di investimento e di servizi non diventano liquidità aggiuntiva.

Le carte sono considerate una passività se negative e un'attività se positive; il credito della carta non viene chiamato liquidità bancaria disponibile. La spesa nasce con l'acquisto, il regolamento successivo muove soltanto la cassa e il debito.

I prezzi correnti vengono applicati alle quantità e arrotondati per posizione prima della somma dei valori. Date precedenti o quotazioni non documentate rendono provvisorie le valorizzazioni. Lo storico patrimoniale non viene ricostruito usando una quotazione futura.

`sum()` separa spesa complessiva, commissioni d'investimento, spesa operativa e risultato realizzato. Non sommare una plusvalenza già netta e sottrarre nuovamente le commissioni che contiene. Il risultato realizzato è distinto dalla variazione patrimoniale, che include le rivalutazioni.

## Giornale a contropartite

`accountingJournal(state, asOf)` costruisce un giornale di controllo per dati strutturalmente completi:

- cassa e debiti contrapposti a redditi, spese o patrimonio iniziale;
- trasferimenti interni bilanciati nello stesso evento;
- acquisti contrapposti al costo del titolo, con commissioni capitalizzate;
- vendite contrapposte allo scarico del costo e al risultato realizzato; commissione di vendita distinta;
- valorizzazioni contrapposte alla riserva/risultato di valutazione.

Ogni evento e il bilancio di verifica devono sommare esattamente zero. Le quantità e i costi residui vengono confrontati con le posizioni. Se i dati sono incompleti o incoerenti il giornale rifiuta la certificazione tecnica: non crea una contropartita generica solo per far tornare il totale.

Il giornale comprende l'intero perimetro dei conti forniti. La dashboard può escludere conti a gestione separata: non confrontare due perimetri diversi senza un ponte.

## Archivi storici e importazione

Le operazioni storiche senza quantità/prezzi o giroconti non abbinati rimangono leggibili. Un indicatore mostra i controlli aperti e dichiara provvisori i totali. Non è un'affermazione che ogni riga segnalata sia errata.

Il pannello dei controlli permette di collegare due contropartite storiche già presenti, con conferma esplicita, senza creare movimenti né alterare saldi. Nessun candidato o più candidati non autorizzano una scelta automatica. Restano necessari i riscontri con gli estratti.

CSV: `id;date;description;amount;account;type;category` più gli eventuali `transferId`, `transferFee`, `transferFeeFor`, `commissionFor`, `refundFor`, `security`, `securityQty`, `securityUnitPrice`, `tradeCommission`, `tradeSide`, `tradeAmountBasis`, `cashAccount`, `commissionAccount`, `relatedAccountId`. Per ripetere un'importazione in modo idempotente usare ID stabili: stesso ID e stessi dati non generano una seconda operazione; stesso ID e dati diversi causano rifiuto. Quantità × prezzo deve coincidere con il lordo ai centesimi. L'anteprima mostra le variazioni previste per conto. Gli errori annullano l'intero batch.

Un estratto OCR privo di dati necessari non può generare nuove compravendite incomplete. I dettagli devono essere completati e verificati; l'estrazione di testo non è una prova contabile. Gli importi di un estratto con saldo iniziale e finale devono quadrare esattamente. Un totale scontrino non rilevato resta da completare, non viene dichiarato quadrato.

Il ripristino JSON conserva il contenuto del backup e gli originali, valida il formato e gli invarianti obbligatori, e mantiene il punto di sicurezza dell'archivio precedente. Gli elementi legacy riconoscibili rimangono segnalati; dati strutturalmente invalidi non vengono scritti. I campi opzionali nuovi non cambiano i nomi dei database o il protocollo cloud.

## Prove indipendenti e riproducibili

```sh
bash scripts/verify-accounting.sh
```

Servono Node 22+, Python 3, Chromium/Chrome e Playwright o playwright-core. Nel cloud gli strumenti browser sono già disponibili. Per un altro ambiente, installare il solo SDK di test, senza modificare dipendenze applicative:

```sh
npm install --prefix /tmp/tefinanza-browser --no-audit --no-fund --package-lock=false playwright-core@1.62.1
NODE_PATH=/tmp/tefinanza-browser/node_modules CHROMIUM_PATH=/percorso/chrome bash scripts/verify-accounting.sh
```

Il comando esegue:

1. Confronto della fixture con un oracolo Python Decimal che non importa codice dell'app. La fixture non viene rigenerata silenziosamente durante i test.
2. Controllo struttura e suite Node esistenti e contabili.
3. Suite del backup nativo/toolbox.
4. Sei mutazioni note in copie temporanee: regressioni su arrotondamenti, trasferimenti, riconciliazione, crediti carta, costi parziali e atomicità. Ogni regressione deve far fallire almeno un controllo. Il checkout non viene mutato.
5. Test dell'app reale in Chromium, con un profilo temporaneo, data di prova fissa e tutte le richieste esterne bloccate. Il server è solo loopback e viene chiuso al termine.

L'oracolo comprende dodici stati di una sequenza banca/wallet/carta/titoli e 160 eventi deterministici (seed 73119), con risultati ricalcolati separatamente. Ogni stato viene confrontato per saldi, cassa, passività/crediti, patrimonio, reddito e spesa. Il giornale deve quadrare e restituire il medesimo patrimonio.

Il test browser verifica importazione CSV e ID ripetuti, rifiuto atomico, acquisto/modifica/eliminazione, regolamento carta, acquisto titoli e modifica, vendita e modifica, eliminazione e ripristino del costo, protezione delle operazioni successive, export JSON nativo, ripristino nell'app, byte degli allegati e persistenza dopo riapertura. Verifica inoltre rifiuto di un ripristino invalido, importazione di compravendita completa, conflitto di ID, abbinamento storico tramite interfaccia, rimborso e cashback.

Le pipeline GitHub e di deployment eseguono questi controlli prima della pubblicazione. L'assenza del browser o una verifica fallita blocca il processo: non viene sostituita con un test vuoto.

## Limiti dichiarati

Queste prove attestano i comportamenti verificati e la resistenza alle sei regressioni simulate; non dimostrano che ogni possibile combinazione futura sia priva di errori. Non certificano i saldi personali e non riconciliano automaticamente lo storico. Non sono test su Safari/iPhone fisici, su fornitori OCR di tutti gli intermediari o sulla sessione Cloudflare Access dell'utente.

Multi-valuta, fiscalità completa, corporate action, cambio di perimetro e rettifiche di inventario richiedono dati e regole esplicite. Non vengono simulati inserendo guadagni o contropartite fittizie. I test funzionali e i relativi artefatti usano soltanto dati sintetici.

I salvataggi usano un confronto di versione nella stessa transazione IndexedDB: una scheda obsoleta deve ricaricare prima di scrivere. I test browser verificano il rifiuto senza perdere dati o allegati, e l’annullamento effettivo del ripristino. La modifica dei giroconti conserva i riferimenti documentali. Le vecchie conferme di saldo prive di base verificabile vengono segnalate senza correggere automaticamente il saldo iniziale.

Una posizione riaperta da quantità zero usa il prezzo di esecuzione del nuovo acquisto come riferimento provvisorio, con provenienza visibile. Il costo sostenuto include la commissione; il controvalore di riferimento la esclude. Una quotazione successiva resta distinta e autorevole. Le vecchie riaperture vengono corrette solo se i metadati dimostrano che il prezzo è stato ereditato invariato dalla posizione azzerata; quantità, costo e movimenti restano invariati e il riferimento precedente è conservato.
