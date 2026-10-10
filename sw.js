var CACHE = "iata-mdd-v17";
var SHELL = ["./", "./index.html", "./app-core.js", "./db-onu.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(SHELL).then(function() { return self.skipWaiting(); });
  }));
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url || "";
  // version.json : toujours réseau (jamais de cache)
  if (url.indexOf("version.json") !== -1) {
    e.respondWith(fetch(e.request).catch(function() { return new Response("{}", { headers: { "Content-Type": "application/json" } }); }));
    return;
  }
  // v17 : RÉSEAU D'ABORD pour tout le reste (app-core.js inclus) — l'ancien cache-first
  // figeait app-core.js sur la version installée du SW (bug « la recherche express ne fonctionne pas »).
  e.respondWith(fetch(e.request).then(function(r) {
    var copy = r.clone();
    caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
    return r;
  }).catch(function() {
    return caches.match(e.request).then(function(m) { return m || caches.match("./index.html"); });
  }));
});
