var CACHE = "iata-mdd-v11b";
var SHELL = ["./", "./index.html", "./app-a.b64", "./app-b.b64", "./db-onu.js", "./manifest.webmanifest", "./icon.svg"];

function b64bytes(s){
  s = s.replace(/\s+/g, "");
  var bin = atob(s), n = bin.length, out = new Uint8Array(n);
  for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function appHtml(){
  return caches.open(CACHE).then(function(c){
    return Promise.all([c.match("./app-a.b64"), c.match("./app-b.b64")]).then(function(m){
      if (!m[0] || !m[1]) throw new Error("blocs absents du cache");
      return Promise.all([m[0].text(), m[1].text()]);
    }).then(function(t){
      if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream indisponible");
      return new Response(new Blob([b64bytes(t[0] + t[1])]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    });
  });
}

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return c.addAll(SHELL).then(function(){ return self.skipWaiting(); });
  }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  if (e.request.method !== "GET") return;
  var url = e.request.url || "";
  if (url.indexOf("version.json") !== -1) {
    e.respondWith(fetch(e.request).catch(function(){ return new Response("{}", { headers: { "Content-Type": "application/json" } }); }));
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(appHtml().then(function(h){
      return new Response(h, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }).catch(function(){
      return fetch(e.request).then(function(r){
        var copy = r.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, copy); });
        return r;
      }).catch(function(){
        return caches.match(e.request).then(function(m){ return m || caches.match("./index.html"); });
      });
    }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(m){ return m || fetch(e.request); }));
});
