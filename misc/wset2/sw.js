const CACHE = 'vinewise-l2-v3-fresh-navigation-1';
const scope = new URL(self.registration.scope);
const index = new URL('index.html', scope);
const assets = [index, ...['manifest.webmanifest', 'icon-192.png', 'icon-512.png'].map(path => new URL(path, scope))];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(assets.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('vinewise-l2-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function appPage(request) {
  const cache = await caches.open(CACHE).catch(() => null);
  let response;
  try {
    response = await fetch(request, {cache: 'no-cache'});
    if (response.ok) {
      if (cache) await cache.put(index.href, response.clone()).catch(() => {});
      return response;
    }
    if (response.status < 500) return response;
  } catch {
    // The cached app remains available when the connection drops.
  }
  return (await cache?.match(index.href)) || response || Response.error();
}

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin) return;
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === index.pathname)) {
    event.respondWith(appPage(request));
    return;
  }
  if (assets.some(asset => asset.href === url.href)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(response => response || fetch(request)));
  }
});
