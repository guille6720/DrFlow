/* Service worker mínimo para habilitar instalación PWA en portal pacientes. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  /* Network-first: sin cache offline por ahora. */
});
