const CACHE_NAME = 'weevtrack-v4';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let title = 'WeevTrack';
  let body = '';
  let url = '/dashboard';
  try {
    const d = event.data.json();
    if (d.title) title = d.title;
    if (d.body) body = d.body;
    if (d.url) url = d.url;
  } catch {}

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, { body, tag: title + body });
      } catch (e) {
        await self.registration.showNotification('WeevTrack', { body });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.tag ? '/dashboard' : '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow('/dashboard');
    })
  );
});
