const CACHE = 'gold-sniper-v2-6-1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first for navigation (prevents old UI from reappearing)
  if(req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c=>c.put('./index.html', copy)).catch(()=>{});
        return res;
      }).catch(()=> caches.match('./index.html'))
    );
    return;
  }

  // Network-first for API calls
  if (url.pathname.includes('/time_series') || url.pathname.includes('/usd_events') || url.pathname.includes('/sentiment')) {
    e.respondWith(
      fetch(req).then(res => res).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
