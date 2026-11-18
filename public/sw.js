const CACHE_NAME = 'eng-hub-shell-v6';
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [BASE_PATH, `${BASE_PATH}manifest.json`, `${BASE_PATH}icons/icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('eng-hub-shell-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Always prefer the latest deployed HTML. The old cache-first navigation
  // strategy could serve an index.html that referenced deleted, hashed assets.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(BASE_PATH, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request)) || (await caches.match(BASE_PATH)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch {
      return Response.error();
    }
  })());
});
