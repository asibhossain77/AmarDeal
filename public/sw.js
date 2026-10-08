/* Service Worker — PWA + Push Notifications */

const CACHE_NAME = 'amardeal-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  event.waitUntil(clients.claim());
});

// ─── Intentionally NO fetch handler ───
// A previous version had:  event.respondWith(fetch(event.request));
// That passthrough intercepted EVERY request in scope (including document
// navigations) with no origin/mode/path filtering, and it must stay removed:
//
// 1. It implemented no caching at all (nothing is ever cache.put() here), so
//    it only added an interception layer that returned exactly what the
//    browser would have fetched anyway.
// 2. FATAL for OAuth: the consent form POST /api/oauth/authorize is a
//    navigation request. When the server answers 303 with a cross-origin
//    Location (https://verify.midman.bd/auth/callback?code=...&state=...),
//    fetch() inside the SW cannot follow a cross-origin redirect for a
//    navigate-mode request — the promise REJECTS ("The FetchEvent ... the
//    promise was rejected", stack at the old sw.js:21) and the browser gets
//    a network error instead of performing the redirect. "Login with
//    Midman" therefore died on Continue and never reached the Verify callback.
// 3. Same-origin POST navigations (the consent form) must be handled by the
//    browser's normal navigation pipeline so the 303 can navigate the tab.
//
// Keep it this way unless a real offline/caching strategy is designed —
// and if one ever is, it MUST bypass: navigations, non-GET methods,
// cross-origin requests, /oauth/*, and /api/oauth/*.

// ─── Push Notification Handler ───
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: event.data.text() || 'Notification', body: '' };
    }
  }

  const title = data.title || 'নতুন নোটিফিকেশন';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    tag: data.tag || 'default',
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'খুলুন' },
      { action: 'dismiss', title: 'বন্ধ করুন' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click Handler ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});
