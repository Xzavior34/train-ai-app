// Train AI Service Worker
// Version: 2026-10-02-v8 (Clean network-first with aggressive cache purging)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // 1. Purge every cache bucket to ensure no user remains trapped on stale assets
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // 2. Notify all open client windows to refresh if on stale version
      return self.clients.matchAll({ type: "window" });
    }).then((clients) => {
      for (const client of clients) {
        if (client.url && "navigate" in client) {
          // Re-navigate client to fresh network version
          client.navigate(client.url);
        }
      }
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
