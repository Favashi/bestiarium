// Service worker: precachea la app para que funcione sin conexión.
// Cambia VERSION cada vez que publiques cambios para forzar la actualización.
const VERSION = 'v32';
const CACHE = `bestiario-${VERSION}`;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/fonts.css', 'css/app.css', 'css/cards.css', 'css/print.css',
  'js/app.js', 'js/model.js', 'js/store.js', 'js/render.js', 'js/fit.js', 'js/ui.js',
  'js/io.js', 'js/image.js', 'js/samples.js', 'js/state.js', 'js/parse.js', 'js/decks.js', 'js/credits.js', 'js/tutorial.js', 'js/analytics.js', 'js/theme.js',
  'js/views/library.js', 'js/views/editor.js', 'js/views/print.js', 'js/views/settings.js', 'js/views/credits.js',
  'icons/icon.svg', 'icons/compatible-mork-borg.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/pirata-one-latin-400-normal.woff2',
  'fonts/oswald-latin-500-normal.woff2', 'fonts/oswald-latin-700-normal.woff2',
  'fonts/jost-latin-400-normal.woff2', 'fonts/jost-latin-400-italic.woff2',
  'fonts/jost-latin-600-normal.woff2', 'fonts/jost-latin-700-normal.woff2',
  'fonts/UnifrakturCook-Bold.woff2', 'fonts/SpaceMono-Regular.woff2', 'fonts/SpaceMono-Bold.woff2',
  'fonts/Alegreya-Variable.woff2', 'fonts/Alegreya-Italic-Variable.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => (k.startsWith('grimorio-') || k.startsWith('bestiario-')) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

// Red primero para que los cambios se vean al instante con conexión; caché si no hay red.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
