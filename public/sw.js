// DMJ HRIS — High Performance Progressive Web App (PWA) Service Worker
const SW_VERSION = '2026.11.16-v2';
const CACHE_NAME = `prime-hris-core-${SW_VERSION}`;

// Core assets to pre-cache on install for instant native boot
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/maskable-icon-512x512.png',
  '/models/face-api.js'
];

// Message Listener: Support instant SKIP_WAITING from client update prompt
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install Event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache critical shell; ignore individual failures so install doesn't fail
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => console.warn('[PWA SW] Precache missed for:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches and take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[PWA SW] Removing obsolete cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent routing (Network-First for APIs, Cache-First/Stale-While-Revalidate for Assets)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Non-GET requests (POST, PUT, DELETE) bypass service worker
  if (req.method !== 'GET') {
    return;
  }

  // 2. Ignore Chrome extension or non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 3. API requests: Network-First (strict live data from SQLite)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // If successful GET API, keep a background clone for offline resilience
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ offline: true, error: 'Koneksi internet terputus (Mode Offline)' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 4. HTML Navigation Requests (App Shell): Network-First with fallback to index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', resClone)).catch(() => {});
          return networkRes;
        })
        .catch(async () => {
          const cachedIndex = await caches.match('/index.html') || await caches.match('/');
          if (cachedIndex) return cachedIndex;
          return new Response('Mode Offline - DMJ HRIS', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 5. Static Assets (JS, CSS, Images, Fonts, Face Models): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
          }
          return networkRes;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// =========================================================================
// PWA SYSTEM NOTIFICATION BAR (Android / iOS / Desktop Native Tray)
// =========================================================================

// 1. Message listener to trigger system notification via Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SYSTEM_NOTIFICATION') {
    const { title, options } = event.data;
    const notificationTitle = title || 'DMJ HRIS Notifikasi';
    const notificationOptions = {
      body: options?.body || 'Pemberitahuan dari sistem DMJ HRIS.',
      icon: options?.icon || '/icons/icon-192x192.png',
      badge: options?.badge || '/favicon.svg',
      vibrate: options?.vibrate || [250, 100, 250],
      tag: options?.tag || 'dmj-hris-notif',
      renotify: true,
      data: {
        url: options?.url || options?.data?.url || '/',
        timestamp: Date.now()
      },
      ...options
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  }
});

// 2. Web Push Listener for remote server events
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'DMJ HRIS System Alert', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'DMJ HRIS Pemberitahuan';
  const options = {
    body: data.body || 'Pemberitahuan penting dari aplikasi DMJ HRIS.',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/favicon.svg',
    vibrate: data.vibrate || [300, 150, 300],
    tag: data.tag || 'dmj-hris-push',
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Buka Aplikasi' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 3. Notification Click: Opens/focuses the PWA window and navigates to the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

