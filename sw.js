const CACHE = "wam-v13";
const CORE = ["./", "./index.html", "./app.css", "./app.js", "./manifest.json"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(c => c.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match(event.request)));
});
