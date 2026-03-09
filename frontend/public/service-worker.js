// public/service-worker.js
const CACHE_NAME = 'kicowasco-cache-v1';

// 1. Install step: Cache the core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico'
      ]);
    })
  );
  self.skipWaiting();
});

// 2. Fetch step: Serve from cache if offline
self.addEventListener('fetch', (event) => {
  // We only want to cache standard GET requests (like HTML, CSS, JS)
  // We DO NOT intercept API calls (POST/PATCH) because our localForage SyncContext handles that.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// 3. Activate step: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});