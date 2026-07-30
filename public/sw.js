// Hand-written service worker (no vite-plugin-pwa/workbox — deliberately, see
// project notes on avoiding new build-tool deps where possible). Originally
// added just for push notifications; this pass adds real offline resilience
// on top of the same file without touching the push/notificationclick
// handlers below, which usePushNotifications.js already depends on.
//
// Strategy:
//  - Navigation requests (HTML page loads): network-first, falling back to
//    the cached app shell, and finally to a static offline.html page if
//    nothing is cached yet (e.g. very first visit was interrupted).
//  - Same-origin static assets (JS/CSS bundle files, images, fonts, the
//    manifest): cache-first, so a repeat visit loads instantly and keeps
//    working offline, with a background revalidation fetch to keep the
//    cache fresh for next time.
//  - Cross-origin requests (Supabase REST/Auth/Storage/Functions calls,
//    any CDN) are left completely alone — intercepting and caching live API
//    responses would risk serving stale data as if it were current, which
//    is worse than just letting those requests fail naturally when offline.
const CACHE_NAME = "trainai-pwa-v2";
const OFFLINE_URL = "/offline.html";
const ASSETS_TO_CACHE = ["/", "/index.html", "/manifest.json", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Individually tolerant of a single missing asset (e.g. offline.html
      // not deployed yet) instead of cache.addAll(), which rejects the
      // whole batch if any one request 404s.
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  // Only handle same-origin requests — everything else (Supabase, fonts CDN,
  // etc.) passes straight through to the network untouched.
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

  // Cache-first for static assets: JS/CSS bundle files, images, fonts, the
  // manifest, etc.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Revalidate in the background so the next load picks up changes,
        // without making this load wait on the network.
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {/* offline — cached copy already served below */});
        return cachedResponse;
      }
      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(OFFLINE_URL));
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
