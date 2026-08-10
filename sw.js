const CACHE = 'operation-clinic-v22-push-2026-08-10';
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
self.addEventListener(
  'push',
  event => {

    let data = {};

    try {
      data = event.data
        ? event.data.json()
        : {};
    }
    catch {
      data = {
        title: 'Clinic notification',
        body: event.data?.text() || ''
      };
    }

    const icon =
      new URL(
        'assets/alaa-clinic-logo.png',
        self.registration.scope
      ).href;

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Clinic notification',
        {
          body: data.body || '',
          icon,
          badge: icon,
          tag: data.tag || undefined,
          renotify: true,

          data: {
            url: data.url || 'app.html',
            appointmentId:
              data.appointmentId || null
          }
        }
      )
    );
  }
);


self.addEventListener(
  'notificationclick',
  event => {

    event.notification.close();

    const targetUrl =
      new URL(
        event.notification.data?.url
          || 'app.html',
        self.registration.scope
      ).href;

    event.waitUntil(
      clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true
        })
        .then(async windows => {

          for (const client of windows) {
            if ('navigate' in client) {
              await client.navigate(targetUrl);
              return client.focus();
            }
          }

          return clients.openWindow(targetUrl);
        })
    );
  }
);
