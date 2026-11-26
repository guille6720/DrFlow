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

const DEMO_PORTAL_PATH = "/portal/nexclinic-demo-medica-15d";

self.addEventListener("push", (event) => {
  let reminder;
  try {
    reminder = event.data?.json();
  } catch {
    return;
  }
  if (reminder?.kind !== "lamejor-turno-hoy" || reminder.path !== DEMO_PORTAL_PATH ||
      !Number.isSafeInteger(reminder.count) || reminder.count < 1 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reminder.day)) return;

  const show = self.registration.showNotification("NexClinic", {
    body: reminder.count === 1 ? "Hoy tenés un turno confirmado." : "Hoy tenés turnos confirmados.",
    icon: "/icon-patient-192.png",
    badge: "/icon-patient-192.png",
    tag: `nexclinic-turno-${reminder.day}`,
    data: { path: DEMO_PORTAL_PATH },
  });
  const badge = "setAppBadge" in self.navigator ? self.navigator.setAppBadge(reminder.count) : Promise.resolve();
  event.waitUntil(Promise.allSettled([show, badge]));
});

self.addEventListener("notificationclick", (event) => {
  if (event.notification.data?.path !== DEMO_PORTAL_PATH) return;
  event.notification.close();
  event.waitUntil((async () => {
    if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge().catch(() => {});
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const portal = windows.find((client) => new URL(client.url).pathname === DEMO_PORTAL_PATH);
    if (portal) await portal.focus();
    else await self.clients.openWindow(DEMO_PORTAL_PATH);
  })());
});
