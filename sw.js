// KNOWIT service worker — app shell cache-first, everything else network-first.
// Bump CACHE when the shell changes; old caches are dropped on activate.
const CACHE = 'knowit-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './favicon.png',
  './apple-touch-icon.png',
  './og-image.png',
];

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Lexend+Zetta:wght@700&family=Lexend:wght@400;500;600;700&display=swap';

// Shell files are matched by basename so the /knowit/ prefix never matters.
const SHELL_FILES = new Set(['', 'index.html', 'manifest.webmanifest', 'favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'og-image.png']);
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

const INDEX_URL = new URL('index.html', self.location.href).href;

function isShell(url) {
  if (url.origin === self.location.origin) {
    const path = url.pathname;
    return SHELL_FILES.has(path.substring(path.lastIndexOf('/') + 1));
  }
  return FONT_HOSTS.has(url.hostname);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One bad file must not abort the whole install.
    await Promise.all(SHELL.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    await cache.add(new Request(FONT_CSS, { mode: 'cors' })).catch(() => {});
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Navigations (?d=..&vs=.. included): serve the cached shell, ignoreSearch so any query works offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(INDEX_URL, { ignoreSearch: true });
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(INDEX_URL, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await network) || (await cache.match('./', { ignoreSearch: true })) || Response.error();
    })());
    return;
  }

  // App shell + Google Fonts: cache-first, fill the cache on miss.
  if (isShell(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || Response.error();
      }
    })());
    return;
  }

  // Everything else: network-first, cache as a fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
