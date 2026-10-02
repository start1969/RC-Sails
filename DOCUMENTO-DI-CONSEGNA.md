# RC Sails Scoring — Documento di Consegna

**Versione del progetto:** 15.20
**Data:** 8 settembre 2026
**Titolare:** Stefano Ragusa — tutti i diritti riservati

Questo documento serve a **riprendere il lavoro** su questo progetto: da solo,
fra sei mesi, oppure aprendo una conversazione nuova con un assistente. Contiene
le decisioni prese e il perché, i riferimenti regolamentari verificati, i difetti
trovati e chiusi, e i punti ancora aperti.

Il codice sta nel pacchetto `RC-Sails_v15.18.zip`. Questo documento è il contesto
che il codice da solo non racconta.

---

## 1. Che cos'è

Applicazione web installabile per il calcolo dei punteggi di regata nella **vela
radiocomandata**, conforme alle **RRS 2025-2028** (Appendice A) come modificate
dall'**Appendice E**.

Funziona interamente **offline** e **senza server**: tutti i dati restano sul
dispositivo di chi la usa.

**Pubblicata su:** `https://start1969.github.io/RC-Sails/`
**Repository:** `https://github.com/start1969/RC-Sails`

### Da dove nasce

Il punto di partenza era `GRCS_SCORING-14.html`, un file HTML unico da 790 KB.
Funzionava, ma conteneva difetti di calcolo che potevano falsare una classifica,
e non era distribuibile. Il lavoro è consistito in: correzione del motore di
punteggio, parametrizzazione, scomposizione in applicazione installabile,
aggiunta di campionato, sequenza di partenza e documenti ufficiali.

---

## 2. Come è fatto

```
rc-sails/
├── index.html                    applicazione completa (220 KB)
├── manifest.webmanifest          descrittore di installazione
├── sw.js                         service worker — funzionamento offline
├── LICENSE                       licenza proprietaria
├── THIRD-PARTY-NOTICES.md        conformità Apache 2.0 per SheetJS
├── assets/                       logo e quattro icone
├── vendor/
│   ├── xlsx.mini.min.js          SheetJS CE (Apache 2.0)
│   └── LICENSE-Apache-2.0.txt
└── test/                         120 casi di verifica automatica
```

**`index.html` è il sorgente.** Non esiste una fase di compilazione: si modifica
direttamente. Il logo e la libreria Excel sono file separati apposta — nella
versione originale erano incorporati in base64 e il logo era duplicato cinque
volte, per 440 KB sprecati.

### Regole non ovvie da rispettare

1. **`#print-area` deve restare il primo figlio di `<body>`.** La regola di
   stampa nasconde tutti gli altri figli diretti di `body`. Ogni pagina nuova
   va messa **dentro `#app`**, altrimenti compare sopra i documenti stampati.
   Questo errore è stato commesso due volte.

2. **Ogni pubblicazione richiede di cambiare `VERSIONE` in `sw.js`.** Senza,
   i dispositivi già installati continuano a servire la copia in cache e non
   vedranno mai le modifiche. Nessun segnale d'errore: sembra solo che
   l'aggiornamento non sia servito.

3. **L'ordine delle regole CSS conta.** Una regola aggiunta *prima* di una
   dichiarazione esistente con la stessa specificità viene sopraffatta. È
   costato un pomeriggio con la barra di navigazione.

4. **Caricare su GitHub il *contenuto* di `rc-sails/`,** non la cartella:
   `index.html` deve stare nella radice del repository.

---

## 3. Le decisioni di progetto

### Perché una PWA e non un'app nativa

Su un campo di regata non c'è connettività affidabile. L'app installata funziona
in modalità aereo. Un'app nativa avrebbe richiesto due basi di codice, due store,
99 euro l'anno per Apple e una revisione a ogni versione — senza dare nulla che
una PWA non dia già.

### Perché nessun server

Nel momento in cui i dati di regata passano da un server, il titolare diventa
responsabile del trattamento di nomi e risultati di persone fisiche. Tenendo
tutto sul dispositivo, quel perimetro non si apre nemmeno.

### Perché nessun font esterno

I caratteri erano caricati da Google Fonts. Offline non arrivavano e
l'impaginazione degradava; inoltre era l'unica chiamata a un dominio esterno,
quindi l'unica che rivelava l'indirizzo IP di chi apriva l'app. Ora si usano
caratteri di sistema, con cifre tabellari per allineare le colonne dei punteggi.

### Perché il campionato aggrega i risultati, non le prove

Tappe diverse hanno numeri di prove diversi. Nel banco di prova la stessa
persona valeva 11, 29 e 23 punti netti in tre tappe da 5, 12 e 9 prove:
**sommarli non ha senso sportivo**. I piazzamenti invece sono omogenei. Per
questo il criterio predefinito è "piazzamenti di tappa".

### Perché i segnali di partenza sono toni e non voce

La sintesi vocale ha latenza variabile e non è programmabile in anticipo. La
regola E3.4 impone che ogni segnale sia conteggiato **dall'inizio del suono**.
Quindi avviso, preparatorio e partenza sono toni programmati sull'orologio della
scheda audio, precisi al campione. La voce scandisce solo i conteggi intermedi,
che la stessa regola ammette come "segnali vocali".

### Perché i turni di giuria non usano `indice % numero barche`

Quella formula funziona solo se l'elenco non cambia mai. Escludendo una persona
la sequenza futura slitta e può regalare turni doppi. Su 200 scenari casuali di
esclusione il modulo supera lo scarto di un turno in **59 casi**; il criterio
"assegna a chi ha fatto meno turni" resta sempre entro un turno.

### Perché i suoni non usano `setInterval`

Un timer JavaScript deriva e viene sospeso quando il browser passa in secondo
piano. I diciassette suoni della sequenza sono tutti accodati **in una volta**
sull'orologio audio quando si preme Avvia.

---

## 4. Riferimenti regolamentari verificati

Tutti controllati sul testo vigente, non a memoria. Sono il vero valore del
progetto: il codice si riscrive, questa conoscenza no.

| Regola | Contenuto | Come è implementata |
|---|---|---|
| **A2.1** | Si escludono i peggiori; a parità si esclude la prova disputata **per prima** | `findDiscardIndices` ordina per valore poi per indice |
| **A5.2** | DNS/DNF/DSQ = iscritti alla serie + 1 (predefinito) | `dnsPoints()` |
| **A5.3** | Variante sui partenti — solo se invocata dal Bando | opzionale, con campo partenti per prova |
| **A6.1** | Dopo una squalifica le barche dietro **risalgono di un posto** | `rankedOrder()` filtra e riordina |
| **A6.2** | La riparazione non cambia i punteggi altrui | codice RDG |
| **A8** | Parità: punteggi non scartati dal migliore al peggiore, poi ultima prova a ritroso | `compareSeries()`, implementazione unica |
| **A9** | Punteggio medio al decimo, 0,05 per eccesso | `round1()` |
| **A10** | Tredici codici di punteggio | tutti gestiti con audit trail |
| **E3.4** | Segnali a intervalli di un minuto; ogni dieci secondi nell'ultimo minuto; ogni secondo negli ultimi dieci | sequenza di partenza |
| **E3.6** | Richiamo generale: **due** suoni | pulsante dedicato |
| **E3.8(a)** | **Cancella la regola 30.2** | la ZFP non esiste in vela RC — rimossa |
| **E4.1** | **Cancella la regola 44.3** | la SCP non esiste in vela RC — rimossa |
| **E5.1** | Gli osservatori **possono essere concorrenti** | turni di giuria a rotazione |
| **E7** | Penalità a punti discrezionale, anche frazionaria | codice DPI |

### Il ritrovamento più importante

L'applicazione originale aveva un pulsante **ZFP** che applicava una penalità
del 20%. In vela radiocomandata **quella penalità non esiste**: l'Appendice E
cancella sia la regola 30.2 (Z Flag) sia la 44.3 (Penalità a Punti). In più la
formula era sbagliata anche per la vela con equipaggio — il 20% si calcola sul
punteggio DNF, non sul numero di barche — e non aveva il tetto previsto.

È stata rimossa e sostituita con la **DPI** della regola E7, che è la penalità
a punti realmente prevista per la vela RC.

### Quello che resta al Bando di Regata

Le RRS lasciano queste scelte all'organizzatore. Sono parametriche nell'app e
**vanno allineate al Bando**:

- sistema di scarti (quattro modalità) e soglia di attivazione
- adozione o meno della A5.3
- trattamento di chi fa il turno di giuria e **base della media** (tutte le
  prove oppure al netto degli scarti) — **non è una regola RRS**, è convenzione
  di circolo, e va dichiarata
- prove minime per la validità della serie (A1)
- per il campionato: criterio, scarti di tappa, presenze minime, valutazione
  degli assenti

L'app genera un **estratto delle Istruzioni di Regata** che descrive a parole i
parametri impostati, con i riferimenti di regola. Sta in Setup › Regata ›
Utilità › Documenti.

---

## 5. Difetti trovati e chiusi

Registro sintetico. Quasi tutti erano invisibili alla lettura del codice: sono
emersi eseguendo.

### Nel motore di punteggio originale

| Difetto | Conseguenza |
|---|---|
| Rotazione giudici non congelata | Aggiungendo una barca cambiavano **retroattivamente** i giudici delle prove già disputate, e con essi la classifica |
| DSQ, DNE e proteste distruggevano l'ordine d'arrivo | Nessuna reversibilità: annullare una squalifica non restituiva la posizione |
| ZFP non applicabile, formula errata, nessun tetto | Penalità inesistente in vela RC, sbagliata di un punto, poteva superare il DNF |
| Scarti azzerati oltre le 20 prove | Alla ventunesima prova gli scarti crollavano a zero |
| Falsi DNF durante la prova | Le barche non ancora inserite risultavano DNF nella classifica in diretta |
| `loadState` senza merge | Uno stato salvato da una versione precedente cancellava le chiavi nuove e mandava in errore l'app |
| Barche orfane | Passando a flotta doppia sparivano dalla classifica senza avviso |
| Tre implementazioni divergenti del tie-break | Una era il vecchio conteggio dei primi posti, **non più nelle regole** |
| Nessun escaping HTML | Nomi con caratteri speciali rompevano l'impaginazione |
| Logo duplicato cinque volte | 440 KB, il 56% del file |

### Trovati durante lo sviluppo

- **Documento di stampa bianco** — il contenitore era dentro `#app`, che la
  regola di stampa nascondeva.
- **Intestazioni di tabella bianche su bianco** in stampa — mancava
  `print-color-adjust`.
- **Logo mai visibile** — `src=""` iniziale faceva scattare `onerror`, che lo
  nascondeva definitivamente.
- **Ricaricamento spurio alla prima apertura** — il service worker rivendicava
  il controllo e il codice lo interpretava come aggiornamento accettato.
- **DPI su chi era di turno produceva un DNF** — un osservatore può infrangere
  una regola (E2.2) e ricevere punti.
- **Tappa duplicata dopo una correzione** — l'identità era l'impronta del
  contenuto anziché club + nome + data.
- **Pagina Giudici fusa dentro la Classifica** — tag di chiusura consumati da
  una sostituzione troppo ampia.

---

## 6. Verifiche automatiche

**140 casi**, tutti superati alla versione 15.20.

| Suite | Casi | Copre |
|---|---|---|
| `regressione.js` | 22 | motore di punteggio e parametri, conformità RRS |
| `sequenza-partenza.js` | 22 | sequenza E3.4, istanti dei suoni, voce |
| `campionato` | 20 | aggregazione tappe, scarti, presenze minime |
| `documenti` | 20 | classifica ufficiale ed estratto IdR |
| `app` | 16 | interfaccia, persistenza, assenza di richieste esterne |
| `invio-campionato.js` | 10 | invio diretto, correzione e reinvio |
| `installazione.js` | 10 | installazione Android e istruzioni iOS |
| `turni-giuria.js` | 13 | esclusioni, reintegri, riequilibrio dei turni |
| `media-giuria.js` | 7 | base di calcolo del punteggio medio |

Nel pacchetto ci sono `regressione.js` (eseguibile con `node`, senza
dipendenze) e i file delle altre suite, che richiedono Chrome e puppeteer.

**La suite va rieseguita dopo ogni modifica alla logica di punteggio.**

---

## 7. Punti aperti

In ordine di importanza.

1. **HMS — sistema a batterie.** Oltre le 24 barche in acqua la vela RC usa
   batterie con promozione e retrocessione, e quel sistema **modifica
   l'Appendice A**. Senza, l'app resta di circolo; con, diventa utilizzabile in
   campionati zonali e nazionali. È la funzione che apre il mercato.

2. **Foglio ARRIVI dell'export Excel.** Contiene codice residuo dalla versione
   originale: cicli vuoti e righe generate poi sostituite. Mai ripulito.

3. **Audio su iPhone con suoneria silenziosa.** Non verificabile in ambiente di
   sviluppo. Se non suona, l'unica soluzione è l'interruttore laterale — o un
   altoparlante Bluetooth, che funziona senza modifiche.

4. **Bando e Istruzioni di Regata del circuito.** Mai reperiti. I valori
   predefiniti dell'app sono ragionevoli ma **non sono una regola**: vanno
   verificati contro il documento reale, se e quando esisterà.

5. **Logo.** `assets/logo.png` è quello del GRCS. Se appartiene al circolo e
   non al titolare, quel singolo elemento non è suo da licenziare.

6. **Sostituzione di uno skipper a campionato in corso.** Se una barca viene
   rimpiazzata da un'altra persona, oggi si tratta come due iscritti distinti.

---

## 8. Proprietà intellettuale

Licenza **proprietaria, tutti i diritti riservati** su codice, progetto grafico,
interfaccia, impaginazione dei documenti e progettazione funzionale. Uso libero
e gratuito dell'app; vietate copia, modifica, ridistribuzione, riuso del
progetto grafico e impiego commerciale senza autorizzazione scritta.

Il testo completo è in `LICENSE`, bilingue, con riferimento alla Legge 633/1941,
al D.Lgs. 518/1992 e al Codice della Proprietà Industriale.

**SheetJS Community Edition** è sotto Apache 2.0: obbliga a includere il testo
della licenza e le note di copyright. Adempiuto in `THIRD-PARTY-NOTICES.md` e
`vendor/LICENSE-Apache-2.0.txt`. Prima di questo intervento il progetto era in
violazione.

Da tenere presente: su un repository **pubblico** chiunque può leggere e
scaricare il codice. La licenza non lo impedisce tecnicamente, rende illecito
farne uso. Per impedirlo davvero servirebbe un repository privato con
distribuzione diretta ai circoli.

---

## 9. Come riprendere il lavoro

In una conversazione nuova, allega:

1. `RC-Sails_v15.18.zip` — il codice
2. questo documento

e scrivi qualcosa come:

> *Sto sviluppando RC Sails Scoring, un'app per i punteggi di regata di vela
> radiocomandata. Allego il pacchetto e il documento di consegna con lo stato
> del progetto. Vorrei lavorare su [ … ].*

### Cosa chiedere di non fare

- **Non modificare la logica di punteggio senza rieseguire `test/regressione.js`.**
- **Non spostare pagine fuori da `#app`** — vedere la sezione 2.
- **Non fidarsi della lettura del codice** per la resa visiva e la stampa:
  quasi tutti i difetti gravi sono emersi solo eseguendo e guardando.

---

*RC Sails Scoring — © 2026 Stefano Ragusa. Tutti i diritti riservati.*
