// KNOWIT service worker.
// - Navigations + index.html: network-first, so a deploy shows up on the next reload (offline still works).
// - Icons / manifest / og-image: cache-first, they never change between releases.
// - Cross-origin requests (analytics, fonts, API) are left to the browser entirely.
// BUMP `CACHE` ON EVERY RELEASE: activate deletes every cache that isn't this one.
const CACHE = 'knowit-v11';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './og-image.png',
];

// Same-origin files that are safe to serve from cache first.
const STATIC_FILES = new Set(['manifest.webmanifest', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'og-image.png']);

const INDEX_URL = new URL('index.html', self.location.href).href;

function isStatic(url) {
  const path = url.pathname;
  return STATIC_FILES.has(path.substring(path.lastIndexOf('/') + 1));
}

// Navigations share one cache entry, so ?d=…&vs=… works offline from the same copy.
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try { await cache.put(cacheKey, response.clone()); } catch (e) {}
    }
    return response;
  } catch (err) {
    const cached = await cache.match(cacheKey, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match(INDEX_URL, { ignoreSearch: true });
    if (shell) return shell;
    return new Response('Offline', { status: 503, statusText: 'Offline', headers: { 'content-type': 'text/plain' } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try { await cache.put(request, response.clone()); } catch (e) {}
    }
    return response;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // One missing file must not abort the install.
      await Promise.all(SHELL.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    } catch (e) {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    } catch (e) {}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Only same-origin GETs. Everything else (Plausible, Google Fonts, the stats API) is untouched.
  if (request.method !== 'GET') return;
  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  const work = (async () => {
    if (request.mode === 'navigate') return networkFirst(request, INDEX_URL);
    if (isStatic(url)) return cacheFirst(request);
    return networkFirst(request, request);
  })().catch(() => new Response('', { status: 504, statusText: 'Offline' }));

  event.respondWith(work);
});
