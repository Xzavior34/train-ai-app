// Compatibility worker for installations created before OneSignal was moved
// away from the root scope. Do not import the OneSignal SDK here: doing so
// would replace /sw.js at the root and reintroduce the stale-page race.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
