const CACHE="west-amman-v2";
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/index.html","/manifest.json"]))));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET") return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{
    const copy=x.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return x;
  }).catch(()=>caches.match("/index.html"))));
});