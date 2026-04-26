const CACHE_NAME = 'weevtrack-v2';

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
  const data = event.data?.json() ?? {};
  const sound = data.sound !== false;
  const vibrate = data.vibrate !== false;
  event.waitUntil(
    self.registration.showNotification(data.title || 'WeevTrack', {
      body: data.body || '',
      icon: '/api/pwa-icon?size=192',
      badge: '/api/pwa-icon?size=72',
      data: { url: data.url || '/dashboard' },
      tag: data.tag || 'weevtrack',
      renotify: true,
      silent: !sound,
      vibrate: vibrate ? [200, 100, 200] : [0],
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
