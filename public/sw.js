importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCUo5oAxIuhZFzAz7ruzHgCcGeJUBKPsKQ',
  authDomain: 'midman-20168.firebaseapp.com',
  projectId: 'midman-20168',
  storageBucket: 'midman-20168.firebasestorage.app',
  messagingSenderId: '152219785198',
  appId: '1:152219785198:web:f85d53e749fffa6172a0ff',
  measurementId: 'G-MSK0JBQJER'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || 'মিডম্যান', {
    body: data.body || 'নতুন নোটিফিকেশন',
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    tag: data.tag || 'default',
    renotify: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
