// Train AI root service worker.
// It never stores application responses. Page navigations are forced to the
// network with `cache: "no-store"` so a previously cached response for the
// exact `/` URL cannot survive while query-string URLs load correctly.
const WORKER_VERSION = "2026-10-02-v13";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
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

// A poisoned HTTP/CacheStorage entry for exactly `/` caused some Android
// browsers to keep displaying a retired build even though versioned URLs were
// current. Intercept navigations only; hashed JS/CSS and API requests continue
// to use their normal browser/Vercel caching rules.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin || url.pathname === "/refresh.html") return;

  event.respondWith(
    fetch(new Request(request, { cache: "no-store" })).catch(() =>
      new Response(
        "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width\"><title>Train AI</title></head><body style=\"font-family:sans-serif;padding:32px;text-align:center\"><h1>You are offline</h1><p>Reconnect, then reload Train AI.</p></body></html>",
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
      )
    )
  );
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
