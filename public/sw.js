// Cleanup worker for devices that still have an old Train AI worker registered
// at the site root. The application no longer uses a root service worker.
// OneSignal remains isolated under /onesignal/.
const WORKER_VERSION = "2026-10-02-v14-cleanup";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({
          type: "TRAINAI_SW_ACTIVATED",
          version: WORKER_VERSION,
        }));
      })
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
