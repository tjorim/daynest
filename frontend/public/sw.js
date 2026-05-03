const CACHE_NAME = "daynest-shell-v1";
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest"];
const MAX_RUNTIME_ENTRIES = 60;
const MAX_RUNTIME_AGE_MS = 7 * 24 * 60 * 60 * 1000;

async function purgeRuntimeCache() {
  const cache = await caches.open(CACHE_NAME);
  const requests = await cache.keys();
  const now = Date.now();

  await Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request);
      const cachedAt = response?.headers.get("date");
      if (cachedAt && now - new Date(cachedAt).getTime() > MAX_RUNTIME_AGE_MS) {
        await cache.delete(request);
      }
    }),
  );

  const remaining = await cache.keys();
  if (remaining.length <= MAX_RUNTIME_ENTRIES) {
    return;
  }
  await Promise.all(
    remaining
      .slice(0, remaining.length - MAX_RUNTIME_ENTRIES)
      .map((request) => cache.delete(request)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => purgeRuntimeCache())
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/index.html")) || Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { cacheName: CACHE_NAME }).then((cached) => {
      const reqUrl = new URL(event.request.url);
      const isApi = reqUrl.origin === self.location.origin && reqUrl.pathname.startsWith("/api/");
      if (cached && !isApi) return cached;

      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok && !isApi && reqUrl.origin === self.location.origin) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .then(() => purgeRuntimeCache());
        }
        return response;
      });

      return isApi
        ? fetchPromise.catch(() => Response.error())
        : fetchPromise.catch(() => cached || Response.error());
    }),
  );
});
