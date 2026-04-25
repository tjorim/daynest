const CACHE_NAME = 'daynest-shell-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const isApi = event.request.url.includes('/api/');
      if (cached && !isApi) return cached;

      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });

      return isApi ? fetchPromise.catch(() => cached || Response.error()) : fetchPromise.catch(() => Response.error());
    }),
  );
});
