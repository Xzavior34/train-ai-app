// Train AI Service Worker
// Version: 2026-10-02-v10 (Zero-cache network-first with aggressive cache purging & self-unregistration)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Purge every cache bucket to ensure no user remains trapped on stale assets
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      // Unregister this service worker so clients operate on direct clean network
      return self.registration.unregister();
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Pass all fetch requests directly through to the network without caching
// This eliminates stale index.html and stale chunk crashes permanently
self.addEventListener("fetch", (event) => {
  return;
});

// Push notification listeners (retained for Web Push)
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
