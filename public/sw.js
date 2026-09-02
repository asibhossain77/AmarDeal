/* Minimal Service Worker — only for PWA installability */

const CACHE_NAME = 'amardeal-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass through — no caching, no offline support
  // This SW exists only to satisfy PWA install criteria
  event.respondWith(fetch(event.request));
});
