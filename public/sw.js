// Hand-written service worker (no vite-plugin-pwa/workbox)
// Strategy:
//  - Navigation requests (HTML page loads): Network-first with cached shell fallback
//  - Static assets (JS/CSS/images/fonts): Cache-first / Network-first, NEVER return HTML for JS/CSS assets
//  - Cross-origin requests: passed through untouched
//  - Push notifications: Web Push & OneSignal support

const CACHE_NAME = "trainai-pwa-v3";
const OFFLINE_URL = "/offline.html";
const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.json", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data) {
    if (event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
    if (event.data.type === "CLEAR_CACHE") {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((k) => caches.delete(k)));
      });
    }
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Only handle same-origin requests - everything else (Supabase, CDN, etc.) passes straight through
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match("/index.html").then((shell) => shell || caches.match(OFFLINE_URL))
          )
        )
    );
    return;
  }

  // Static assets: JS/CSS bundle files, images, fonts, manifest
  // Note: NEVER return OFFLINE_URL (HTML) for JS/CSS assets, as doing so causes fatal script MIME/syntax errors and blank screens!
  const isHashedAsset = url.pathname.startsWith("/assets/");

  if (isHashedAsset) {
    // Hashed immutable assets: Cache-first
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => new Response("Asset not available offline", { status: 404, statusText: "Not Found", headers: { "Content-Type": "text/plain" } }));
      })
    );
    return;
  }

  // Non-hashed assets (e.g. /manifest.json, /logo.png, etc.): Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response("Resource unavailable offline", { status: 503, statusText: "Unavailable", headers: { "Content-Type": "text/plain" } });
        });
      })
  );
});

// Push notification listener
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
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
