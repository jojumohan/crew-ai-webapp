self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data.json(); } catch (e) {}

  const title = data.title || 'Aronlabz Teams';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'aronlabz',
    renotify: data.renotify || false,
    requireInteraction: data.requireInteraction || false,
    data: { url: data.url || '/dashboard' },
    vibrate: [300, 100, 300, 100, 300],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
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
