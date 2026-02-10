/**
 * Service worker: caches app shell for offline; does not cache ECB API.
 */
const CACHE_NAME = 'currency-notifier-v1';
const APP_SHELL = [
  './',
  'index.html',
  'css/app.css',
  'icons/icon.svg',
  'js/app.js',
  'js/storage.js',
  'js/exchangeApi.js',
  'js/rulesEngine.js',
  'js/notifications.js',
  'js/scheduler.js',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.href.startsWith('https://www.ecb.europa.eu/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request).then((r) => r || caches.match('index.html')))
  );
});
