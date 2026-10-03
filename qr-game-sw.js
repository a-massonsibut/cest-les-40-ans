const QR_GAME_CACHE = 'qr-game-v6';
const QR_GAME_ASSETS = [
  'qr-game.html',
  'qr-game.webmanifest',
  'qr-game-icon.svg',
  'assets/html5-qrcode.min.js'
];
const QR_LIBRARY_PATH = '/assets/html5-qrcode.min.js';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(QR_GAME_CACHE).then(cache => cache.addAll(QR_GAME_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== QR_GAME_CACHE).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Librairie de scan : cache-first, le réseau sert uniquement à la mettre à jour.
  if (requestUrl.pathname === QR_LIBRARY_PATH) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(QR_GAME_CACHE).then(cache => cache.put(event.request, copy));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(QR_GAME_CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
