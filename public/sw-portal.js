/* Service worker solo para la app de pacientes (scope /portal/). Iconos verdes. */
const CACHE = "drflow-portal-pwa-v2";
const PRECACHE = [
  "/icon-patient-192.png",
  "/icon-patient-512.png",
  "/icon-patient-maskable-512.png",
];

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
