const CACHE = 'money-v26';
const ASSETS = ['./', 'index.html', 'styles.css', 'core.js', 'vault.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'changelog.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const pinnedCdn = url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://tessdata.projectnaptha.com';
  if (!sameOrigin && !pinnedCdn) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req, sameOrigin ? { cache: 'no-cache' } : undefined).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
      return sameOrigin ? net : (hit || net);
    })
  );
});
