// public/service-worker.js
const CACHE_NAME = 'kicowasco-cache-v1';
const STATIC_ASSETS_CACHE = 'kicowasco-static-v1';
const API_CACHE = 'kicowasco-api-v1';
const STATIC_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.mp3'];

// 1. Install step: Cache the core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
          '/favicon.ico',
          '/logo192.png',
          '/logo512.png'
        ]);
      }),
      caches.open(STATIC_ASSETS_CACHE).then((cache) => {
        return cache.addAll([
          '/index.html',
          '/manifest.json'
        ]).catch(() => {
          // It's okay if some static assets fail to cache
          return Promise.resolve();
        });
      })
    ])
  );
  self.skipWaiting();
});

// 2. Fetch step: Serve from cache if offline, cache API responses
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests (GET only - POST/PATCH handled by SyncContext)
  if (url.pathname.startsWith('/api/') && request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache for API GET requests
          return caches.match(request).then((cached) => {
            return cached || new Response(
              JSON.stringify({ error: 'Offline. Cached response not available.' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({ 'Content-Type': 'application/json' })
              }
            );
          });
        })
    );
    return;
  }

  // For non-GET requests, don't intercept (SyncContext handles queuing)
  if (request.method !== 'GET') return;

  // Cache-first for local static/form assets
  const isSameOrigin = url.origin === self.location.origin;
  const isStaticAsset = STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
  if (isSameOrigin && isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_ASSETS_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Handle static asset requests with network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        if (request.method === 'GET') {
          caches.open(STATIC_ASSETS_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || new Response('Offline - resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// 3. Activate step: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (![CACHE_NAME, STATIC_ASSETS_CACHE, API_CACHE].includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 4. Handle push notifications for Critical incidents
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      
      // Play alert sound for Critical incidents
      if (data.priority === 'CRITICAL' || data.severity === 'critical') {
        // Note: This requires the alert.mp3 to be bundled in the app
        self.registration.showNotification(data.title, {
          body: data.message,
          icon: '/logo192.png',
          badge: '/favicon.ico',
          tag: data.incidentId,
          vibrate: [200, 100, 200],
          requireInteraction: true,
          sound: '/alert.mp3'
        });
      } else {
        self.registration.showNotification(data.title, {
          body: data.message,
          icon: '/logo192.png',
          badge: '/favicon.ico',
          tag: data.incidentId
        });
      }
    } catch (error) {
      console.error('Error handling push notification:', error);
    }
  }
});

// 5. Handle notification clicks to navigate to the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});