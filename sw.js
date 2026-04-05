// Service Worker for My Movie Collection
// To update: bump the version number below, then redeploy
const VERSION = 'v45';
const CACHE   = 'my-films-' + VERSION;
const ASSETS  = [
  '/movies/',
  '/movies/index.html',
  '/movies/manifest.json',
  '/movies/icon-192.png',
  '/movies/icon-512.png',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — delete old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );


// Fetch — serve from cache, fall back to network
self.addEventListener('fetch', e => {
  // Only handle GET requests for our own origin
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      // Not in cache (e.g. TMDB poster images) — fetch from network
      return fetch(e.request).catch(() => {
        // If network fails too, return a blank response rather than error
        return new Response('', { status: 408 });
      });
    })
  );
});
