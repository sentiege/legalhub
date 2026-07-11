/* Service Worker raiz — JurisParaguay */
const CACHE_NAME = 'jurisparaguay-root-v4'; // <-- bump para limpiar caches viejos

const SHELL = [
  '/jurisparaguay/',
  '/jurisparaguay/index.html',
  '/jurisparaguay/assets/css/styles.css',
  '/jurisparaguay/assets/js/data.js',
  '/jurisparaguay/assets/js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* Verifica que la respuesta sea realmente JSON antes de cachearla */
function esRespuestaJSON(resp) {
  const ct = resp.headers.get('content-type') || '';
  // GitHub Pages sirve .json como text/plain; verificamos que NO sea HTML
  return !ct.includes('text/html');
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // JSON de codigos: cache-first, pero solo si la respuesta NO es HTML
  if (url.includes('.json')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
            // Solo cachear si es JSON real (no el index.html de GH Pages)
            if (resp.ok && esRespuestaJSON(resp)) {
              cache.put(e.request, resp.clone());
            }
            return resp;
          });
        })
      )
    );
    return;
  }

  // Resto: network-first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
