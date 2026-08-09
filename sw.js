const CACHE = 'operation-clinic-v19-calendar-attendance-title-2026-08-09';
const STATIC = [
  './', './index.html', './app.html', './css/style.css', './manifest.webmanifest',
  './js/supabase-client.js', './js/auth.js', './js/core.js', './js/dashboard.js', './js/schedules.js',
  './js/patients.js', './js/appointments.js', './js/clinical.js', './js/referrals.js', './js/notifications.js',
  './js/finance.js', './js/logistics.js', './js/attendance.js', './js/admin.js', './js/reports.js', './js/pwa.js',
  './assets/icon-192.png', './assets/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr.net')) return;
  event.respondWith(fetch(event.request).then(resp => {
    const copy = resp.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return resp;
  }).catch(() => caches.match(event.request).then(r => r || caches.match('./index.html'))));
});
