# RC Sails Scoring — v15.17

**Copyright © 2026 Stefano Ragusa. Tutti i diritti riservati.**

Applicazione per il calcolo dei punteggi di regata nella vela radiocomandata,
conforme alle **RRS 2025-2028** (Appendice A) e all'**Appendice E**.

Installabile sul telefono, funziona **integralmente senza connessione**.
I dati restano sul dispositivo: nessun server, nessun account, nessuna
trasmissione a terzi. Non carica nulla da domini esterni: i caratteri
tipografici sono quelli di sistema, verificati su ogni piattaforma.

---

## Contenuto

```
rc-sails/
├── index.html                    applicazione (152 KB)
├── manifest.webmanifest          descrittore di installazione
├── sw.js                         service worker — funzionamento offline
├── assets/
│   ├── logo.png                  logo del circolo
│   ├── icon-192.png              icona standard
│   ├── icon-512.png              icona standard
│   ├── icon-maskable-512.png     icona adattiva Android
│   └── apple-touch-icon.png      icona schermata Home iOS
├── LICENSE                       licenza d'uso — tutti i diritti riservati
├── THIRD-PARTY-NOTICES.md        componenti di terze parti
├── vendor/
│   ├── xlsx.mini.min.js          libreria per l'export Excel (SheetJS)
│   └── LICENSE-Apache-2.0.txt    licenza della libreria SheetJS
└── test/
    ├── regressione.js            22 casi di verifica del motore
    ├── sequenza-partenza.js      22 casi sulla sequenza RRS E3.4
    ├── invio-campionato.js       10 casi sull'invio delle tappe
    └── motore.js                 motore estratto da index.html
```

Peso complessivo: circa 820 KB, scaricati una sola volta all'installazione.

---

## Pubblicazione

Serve **HTTPS**: i service worker non funzionano su HTTP semplice
(unica eccezione `localhost`, utile per le prove).

### GitHub Pages — gratuito

1. Crea un repository, per esempio `grcs-scoring`.
2. Carica il contenuto di questa cartella nella radice del repository.
3. *Settings → Pages → Source: Deploy from a branch → main → / (root)*.
4. Dopo qualche minuto l'app è su `https://<utente>.github.io/grcs-scoring/`.

Tutti i percorsi sono relativi: l'app funziona in una sottocartella senza
modifiche.

### Alternative equivalenti

Netlify, Cloudflare Pages, Vercel: trascina la cartella, HTTPS incluso.
Oppure qualunque spazio web del circolo, purché con certificato valido.

### Prova in locale

```bash
cd grcs-scoring
python3 -m http.server 8000
```

Poi apri `http://localhost:8000`. Il service worker si registra anche qui.

---

## Installazione sul telefono

**Android (Chrome)** — apri il sito, compare l'invito *Installa app*.
Se non appare: menù ⋮ → *Aggiungi a schermata Home*.

**iPhone/iPad (Safari)** — apri il sito, tocca *Condividi* → *Aggiungi a
schermata Home*. **Deve essere Safari**: su iOS gli altri browser non
possono installare app web.

**Desktop (Chrome, Edge)** — icona di installazione nella barra indirizzi.

Dopo l'installazione l'app si apre a tutto schermo, senza barre del browser,
e funziona in modalità aereo.

---

## Aggiornamenti

Quando pubblichi una versione nuova:

1. Modifica i file.
2. **Cambia `VERSIONE` in `sw.js`** (es. da `rcsails-15.17` a `rcsails-15.18`).

Senza il passo 2 i dispositivi già installati continuano a usare la copia
in cache e non vedranno mai le modifiche.

All'apertura successiva compare l'avviso *Aggiornamento disponibile* con i
pulsanti **Aggiorna** e **Dopo**. L'aggiornamento non è mai forzato: una
regata in corso non viene interrotta. I dati salvati sopravvivono
all'aggiornamento.

---

## Dati e privacy

I dati di regata stanno nel `localStorage` del browser, sul dispositivo.
L'app chiede al browser di **rendere persistente** l'archiviazione, così i
risultati non vengono eliminati automaticamente quando lo spazio scarseggia.

Conseguenze da conoscere:

- Cancellare i dati del sito dalle impostazioni del browser **elimina la
  regata**.
- Disinstallare l'app dalla schermata Home, su iOS, elimina i dati.
- I dati **non** si sincronizzano fra dispositivi. Per trasferire una
  regata si usa l'esportazione Excel.

Prima di una manifestazione importante, esporta a fine giornata.

---

## Verifica del motore di calcolo

```bash
cd test
node regressione.js
```

22 casi di prova: modalità di gara, penalità, scarti, parità, punteggio
medio, parametri di configurazione. Ognuno riporta il riferimento di regola
verificato.

Da eseguire **dopo ogni modifica** alla logica di punteggio.

---

## Sequenza di partenza

Dalla pagina Arrivi, il comando **Partenza** apre la procedura sonora conforme
alla **RRS E3.4**: segnali di avviso, preparatorio e partenza a intervalli di un
minuto, un segnale ogni dieci secondi nell'ultimo minuto, uno al secondo negli
ultimi dieci, e la tromba al via.

Il conteggio può essere **a voce** — i numeri scanditi dalla voce del dispositivo,
ammessi dalla regola come segnali vocali — oppure a **soli segnali acustici**.
Avviso, preparatorio e partenza restano in ogni caso toni sintetizzati: la sintesi
vocale ha una latenza variabile e la regola impone che ogni segnale sia conteggiato
dall'inizio del suono.

I suoni sono sintetizzati — nessun file audio — e sono programmati in anticipo
sull'orologio della scheda audio, non con un timer: non derivano e non si
bloccano se il browser rallenta. Lo schermo resta acceso per tutta la procedura.

Due durate: **2 minuti** — la sequenza regolamentare, predefinita — e **1 minuto**,
ridotta, che va dichiarata nelle Istruzioni di Regata perché omette il segnale di
avviso. È previsto anche il **richiamo generale** con i due suoni della RRS E3.6.

Sul telefono: alzare il volume e, su iPhone, disattivare la suoneria silenziosa.
Il pulsante **Prova la voce** permette di verificare tutto prima della partenza.

## Campionato su più tappe

Dalla pagina Classifica, **Invia i Dati al Campionato** aggiunge la regata come
tappa. Se la tappa è già presente — stesso club, denominazione e data — l'app
chiede conferma e la **aggiorna** invece di duplicarla: è il caso di una
classifica corretta dopo una protesta.

Per passare una regata a **un altro dispositivo** si usa invece la **Scheda
Evento** (file `.rcsails`), che contiene identità dell'evento, formula applicata
e classifica finale, con un'impronta che rileva alterazioni manuali. Si carica
dalla pagina Campionato.
Due criteri disponibili:

- **Piazzamenti di tappa** — il posto conseguito vale i punti. Corretto quando
  le tappe hanno un numero di prove diverso.
- **Somma dei punteggi netti** — da usare solo se tutte le tappe hanno la
  stessa formula.

Gli assenti sono valutati con un punto in più degli iscritti al campionato
(predefinito) oppure dei classificati della tappa: la scelta va allineata al Bando.

Due leve distinte governano la partecipazione: gli **scarti di tappa** perdonano
l'imprevisto, le **presenze minime** pretendono la partecipazione. Chi non
raggiunge la soglia resta classificato ma fuori graduatoria (FG). Indicando le
**tappe in programma** la classifica è marcata come provvisoria finché non sono
tutte disputate.

Un controllo di coerenza segnala in configurazione le combinazioni di parametri
che producono un campionato poco difendibile.

Il file `.rcsails` è anche il modo per **trasferire una regata fra dispositivi**:
il comitato la esporta, il segretario la importa.

Regata e campionato hanno archivi separati: azzerare la regata non tocca il
campionato.

## Nota sulla configurazione

I parametri della sezione **Punteggio** devono corrispondere al Bando di
Regata e alle Istruzioni di Regata della manifestazione. Le RRS lasciano
queste scelte all'organizzatore: sistema di scarti, punteggio di chi fa il
turno di giuria, applicazione della regola A5.3.

I valori predefiniti sono una base ragionevole ma **non sono una regola
generale**: vanno verificati per ogni manifestazione.

---

## Limiti noti

- **Batterie (HMS)** non gestite: l'app copre flotta unica o due flotte
  fisse. Oltre le 24 barche in acqua serve il sistema a batterie con
  promozione e retrocessione, non ancora implementato.
- **Export Excel**: foglio ARRIVI da rivedere, contiene codice residuo.
- **Esportazione PDF** dei risultati e dell'estratto delle Istruzioni di
  Regata: da realizzare.

---

## Licenza e proprietà intellettuale

Tutti i diritti di proprietà intellettuale su **RC Sails Scoring** — codice,
logica di calcolo, progetto grafico, interfaccia, impaginazione dei documenti
generati e progettazione funzionale — appartengono in via esclusiva a
**Stefano Ragusa**.

L'applicazione può essere **usata liberamente e gratuitamente** per la
gestione dei punteggi di regata. Sono invece vietati, senza autorizzazione
scritta: la copia, la modifica, la ridistribuzione, la creazione di opere
derivate, il riuso del progetto grafico e ogni impiego commerciale.

Le condizioni complete sono nel file [`LICENSE`](LICENSE).

Il repository è pubblico per rendere l'applicazione accessibile e installabile:
questo **non** implica alcuna rinuncia ai diritti d'autore. La visibilità del
codice non è una licenza d'uso sul codice.

### Componenti di terze parti

L'esportazione Excel utilizza **SheetJS Community Edition**, distribuita sotto
Apache License 2.0. Il dettaglio e il testo della licenza sono in
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

Nessun carattere tipografico è incorporato: l'applicazione usa i caratteri già
presenti sul dispositivo.

### Esclusione di garanzia

Il software è fornito "così com'è". Il titolare non garantisce che i punteggi
calcolati siano esenti da errori né che corrispondano al Bando di Regata e alle
Istruzioni di Regata di una specifica manifestazione. **La verifica dei
risultati resta responsabilità del Comitato di Regata.**
