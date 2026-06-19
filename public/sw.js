/* Service worker para instalación PWA (consultorio + portal pacientes). */
const CACHE = "drflow-pwa-v2";
const PRECACHE = ["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (PRECACHE.some((path) => url.pathname === path)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached ?? fetch(event.request))
    );
  }
});
