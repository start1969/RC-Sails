/* ══════════════════════════════════════════════════════════════════════
   RC Sails Scoring — Service Worker
   Copyright © 2026 Stefano Ragusa. Tutti i diritti riservati.
   Vedere il file LICENSE.
   Strategia: cache-first su un insieme di risorse precaricate.
   L'applicazione non fa chiamate di rete durante l'uso: una volta
   installata funziona integralmente senza connessione, che è la
   condizione normale su un campo di regata.
   ══════════════════════════════════════════════════════════════════════ */

const VERSIONE = 'rcsails-15.17';
const CACHE    = `rcsails-scoring-${VERSIONE}`;

// Tutto ciò che serve per funzionare offline.
const RISORSE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/xlsx.mini.min.js',
  './assets/logo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png'
];

// ── Installazione: si precarica tutto ────────────────────────────────
self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // addAll fallisce in blocco se una sola risorsa manca: si procede
    // una per una, così un asset assente non impedisce l'installazione.
    await Promise.all(RISORSE.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[sw] risorsa non precaricata:', url, e); }
    }));
  })());
});

// ── Attivazione: si eliminano le cache delle versioni precedenti ─────
self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(
      nomi.filter(n => n.startsWith('rcsails-scoring-') && n !== CACHE)
          .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

// ── Aggiornamento solo su richiesta esplicita dell'utente ────────────
// Non si forza mai: interrompere una regata a metà per un aggiornamento
// sarebbe il peggior comportamento possibile.
self.addEventListener('message', evento => {
  if (evento.data && evento.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Intercettazione richieste ────────────────────────────────────────
self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // font e terzi: non gestiti

  // Navigazione: si serve sempre la shell, anche senza rete.
  if (req.mode === 'navigate') {
    evento.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const rete = await fetch(req);
        cache.put('./index.html', rete.clone());
        return rete;
      } catch (e) {
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('Applicazione non disponibile offline.',
                 { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Risorse: cache-first, con aggiornamento silenzioso in secondo piano.
  evento.respondWith((async () => {
    const cache   = await caches.open(CACHE);
    const inCache = await cache.match(req);
    if (inCache) {
      fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); }).catch(() => {});
      return inCache;
    }
    try {
      const rete = await fetch(req);
      if (rete && rete.ok) cache.put(req, rete.clone());
      return rete;
    } catch (e) {
      return new Response('', { status: 504 });
    }
  })());
});
