const CACHE_VERSION = 'palletpro-v31';
const ASSETS = ['./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c=>c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
    .then(()=>self.clients.matchAll({type:'window'}).then(cs=>cs.forEach(c=>c.postMessage({type:'SW_UPDATED',version:CACHE_VERSION}))))
  );
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('index.html')||url.pathname==='/'||url.pathname.endsWith('/')) {
    event.respondWith(fetch(event.request).then(r=>{caches.open(CACHE_VERSION).then(c=>c.put(event.request,r.clone()));return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(r=>{caches.open(CACHE_VERSION).then(c=>c.put(event.request,r.clone()));return r;})));
});
self.addEventListener('message', event => {
  if (event.data&&event.data.type==='SKIP_WAITING') self.skipWaiting();
});
