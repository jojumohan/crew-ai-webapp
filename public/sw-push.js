self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data.json(); } catch (e) {}

  const title = data.title || 'Aronlabz Teams';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'aronlabz',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/dashboard' },
    sound: data.sound || '/ring.mp3',
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
    actions: data.actions || [
      { action: 'join', title: '✅ Join' },
      { action: 'dismiss', title: '❌ Dismiss' }
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss' || event.action === 'decline') return;

  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
