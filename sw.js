// Shift-Log offline support.
// Keeps the app files on the phone so the page opens with no signal.
// With signal it fetches fresh files first, so updates still come through.
const CACHE = 'shiftlog-v1';
const FILES = ['./', 'index.html', 'products.js', 'home.js', 'crane.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    new Promise((resolve) => {
      let done = false;
      const fromCache = () =>
        caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'));
      // weak signal: give the network 3 seconds, then use the saved copy
      const timer = setTimeout(() => {
        fromCache().then((r) => {
          if (r && !done) { done = true; resolve(r); }
        });
      }, 3000);
      fetch(req)
        .then((res) => {
          clearTimeout(timer);
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          if (!done) { done = true; resolve(res); }
        })
        .catch(() => {
          clearTimeout(timer);
          fromCache().then((r) => {
            if (!done) { done = true; resolve(r || Response.error()); }
          });
        });
    })
  );
});
