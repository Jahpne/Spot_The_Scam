/* ==========================================================================
   sw.js  |  SPOT THE SCAM  (service worker)
   Makes the app work with no internet after the first visit.

   Caches
     spot-the-scam-<VERSION>   the app files + bundled database (precached)
     spot-the-scam-lib         Transformers.js + runtime files from jsDelivr
                               (cached the first time the AI is turned on)

   Not touched on purpose
     huggingface.co model files: Transformers.js stores those itself in the
     browser's Cache Storage ("transformers-cache"). They are large and need
     special handling, so the service worker stays out of the way.
     The remote scam database: db.js fetches it, validates it and keeps its
     own copy, so one blocked request can never break the install.

   To ship an update: change VERSION, then redeploy.
   ========================================================================== */
const VERSION = 'v5';
const CACHE = 'spot-the-scam-' + VERSION;
const LIB_CACHE = 'spot-the-scam-lib';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './checker.js',
  './db.js',
  './apk.js',
  './ai.js',
  './game.js',
  './scan.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './data/scam-db.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // add one by one: a single missing file must not stop the whole install
      .then((cache) => Promise.all(ASSETS.map((a) => cache.add(a).catch((e) => console.warn('[sw] could not cache', a, e)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k.startsWith('spot-the-scam-') && k !== CACHE && k !== LIB_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Library files (Transformers.js + ONNX runtime): cache first, keep forever
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(LIB_CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Everything else cross-origin (Hugging Face, remote database): hands off
  if (url.origin !== self.location.origin) return;

  // App files: serve from cache instantly, refresh in the background
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('./index.html'));
      return hit || refresh;
    })
  );
});
                  
