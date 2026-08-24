const CACHE_NAME = 'midman-v1';

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.claim()
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let data = {
    title: 'মিডম্যান',
    body: 'আপনার একটি নতুন নোটিফিকেশন এসেছে',
    icon: '/logo.svg',
    badge: '/logo.svg',
    url: '/',
    tag: 'default',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    data: {
      url: data.url || '/',
      tag: data.tag || 'default',
    },
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - open URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If already open, focus and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
