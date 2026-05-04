const CACHE_NAME = 'weevtrack-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'WeevTrack', body: event.data?.text() || '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'WeevTrack', {
      body: data.body || '',
      data: { url: data.url || '/dashboard' },
    }).catch(() => {
      return self.registration.showNotification('WeevTrack', { body: data.body || '' });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      const url = event.notification.data?.url || '/dashboard';
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
