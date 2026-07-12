/* Service Worker — JurisParaguay */
const CACHE_NAME = 'jurisparaguay-v5';

const SHELL = [
  '/',
  '/index.html',
  '/assets/css/styles.css',
  '/assets/js/data.js',
  '/assets/js/app.js',
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

function esRespuestaJSON(resp) {
  const ct = resp.headers.get('content-type') || '';
  return !ct.includes('text/html');
}

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // JSON de codigos: cache-first, solo si la respuesta NO es HTML
  if (url.includes('.json')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(resp => {
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
