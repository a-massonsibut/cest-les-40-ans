const QR_GAME_CACHE = 'qr-game-v4';
const QR_GAME_ASSETS = [
  'qr-game.html',
  'qr-game.webmanifest',
  'qr-game-icon.svg'
];

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
