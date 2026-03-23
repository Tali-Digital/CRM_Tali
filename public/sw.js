self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.link || '/', self.location.origin).href;

  const promiseChain = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;

    for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
            matchingClient = windowClient;
            break;
        }
    }

    if (matchingClient) {
        return matchingClient.focus();
    } else {
        return self.clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});

self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      vibrate: [100, 50, 100],
      data: {
        link: data.link || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});
