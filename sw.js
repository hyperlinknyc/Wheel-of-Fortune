// Offline-first service worker.
//
// Everything is precached on install, so after the first load the app works in
// airplane mode. Cache-first with a background refresh: she never waits on the
// network, and a new version lands on the next launch.

const VERSION = 'wheel-trainer-v5';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/ui.js',
  './js/store.js',
  './js/data.js',
  './js/strategy.js',
  './js/lessons.js',
  './js/cheatsheet.js',
  './js/voice.js',
  './js/drills/common.js',
  './js/drills/decision.js',
  './js/drills/bonus.js',
  './js/drills/attention.js',
  './js/drills/names.js',
  './data/puzzles.json',
  './data/names.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('./index.html'));
      // Cache first: offline is the normal case, not the exception.
      return hit || network;
    })
  );
});
