# RC Sails Scoring — v15.5

Applicazione per il calcolo dei punteggi di regata nella vela radiocomandata,
conforme alle **RRS 2025-2028** (Appendice A) e all'**Appendice E**.

Installabile sul telefono, funziona **integralmente senza connessione**.
I dati restano sul dispositivo: nessun server, nessun account, nessuna
trasmissione a terzi.

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
├── vendor/
│   └── xlsx.mini.min.js          libreria per l'export Excel (SheetJS)
└── test/
    ├── regressione.js            22 casi di verifica del motore
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
2. **Cambia `VERSIONE` in `sw.js`** (es. da `grcs-15.5` a `grcs-15.6`).

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
