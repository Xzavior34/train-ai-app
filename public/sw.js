// Train AI Service Worker for Push Notifications and Resilient Offline Support
const CACHE_NAME = "trainai-pwa-v4";
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
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
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

  // Only handle same-origin requests; external APIs pass through
  if (url.origin !== self.location.origin) return;

  // Never cache sw.js itself
  if (url.pathname === "/sw.js") {
    event.respondWith(fetch(request));
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    (request.method === "GET" && request.headers.get("accept")?.includes("text/html"));

  if (isNavigation) {
    // Navigation requests: always network first so users always see the latest deploy
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

  const isScriptOrStyle =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.includes("/assets/");

  // Static assets (hashed JS, CSS, fonts, images)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const contentType = networkResponse.headers.get("content-type") || "";
            // Guard against SPA fallback rewriting a missing 404 JS/CSS chunk to HTML
            if (isScriptOrStyle && contentType.includes("text/html")) {
              return new Response("Asset chunk not found", {
                status: 404,
                statusText: "Not Found",
                headers: { "Content-Type": "text/plain" }
              });
            }
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch((err) => {
          // NEVER return offline.html for script or style files, as it causes fatal syntax errors
          if (isScriptOrStyle) {
            return new Response("Network unavailable", {
              status: 503,
              statusText: "Service Unavailable",
              headers: { "Content-Type": "text/plain" }
            });
          }
          return caches.match(OFFLINE_URL);
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
