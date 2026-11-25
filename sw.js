/* Généré par tools/build-web.js */
'use strict';
const CACHE = "arpege-2.9.0-apercu-1";
const FILES = ["./","app.js","chords.js","core.js","gp.js","icon-512.png","img/guitare.jpg","img/ukulele.jpg","import.js","index.html","manifest.webmanifest","score.js","style.css","update.js","vendor/LICENSE.vexflow.txt","vendor/vexflow.js","version.txt","video.js","web.js"];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys()
  .then((keys) => Promise.all(keys.filter((k) => k.startsWith('arpege-') && k !== CACHE && k !== 'arpege-ocr').map((k) => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true })).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && (url.pathname.includes('/vendor/tesseract/') || url.pathname.includes('/vendor/pdfjs/'))) { const copy = res.clone(); caches.open('arpege-ocr').then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.open('arpege-ocr').then((c) => c.match(e.request)).then((r) => r || Response.error()))));
});
