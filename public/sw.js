// Train AI root service worker.
// It intentionally has no fetch handler: navigation and hashed assets always
// come directly from the network/browser HTTP cache according to Vercel's
// response headers. Its only jobs are legacy-cache migration and native push.
const WORKER_VERSION = "2026-10-02-v11";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("trainai-pwa-"))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => {
        clients.forEach((client) => client.postMessage({
          type: "TRAINAI_SW_ACTIVATED",
          version: WORKER_VERSION,
        }));
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Native Web Push listeners.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Train AI Notification", body: "You have an update!" };
  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/"
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
