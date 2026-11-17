/* Firebase public web-app config. These values are intentionally public client config. */
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDWrjLwgj8r5JPWfzbOIAx76MF7ydCLOB8',
  authDomain: 'eng-hub-5c30a.firebaseapp.com',
  projectId: 'eng-hub-5c30a',
  messagingSenderId: '366947709379',
  appId: '1:366947709379:web:747b0aba2d08056b734d76',
  measurementId: 'G-M2MPGMLD14',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'ENG HUB';
  const options = {
    body: notification.body || data.body || 'لديك إشعار جديد في ENG HUB.',
    icon: new URL('../icons/icon.svg', self.registration.scope).toString(),
    badge: new URL('../icons/icon.svg', self.registration.scope).toString(),
    data: { url: data.url || new URL('../', self.registration.scope).toString() },
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const appRoot = new URL('../', self.registration.scope);
  let destination = new URL(event.notification.data?.url || appRoot.href, appRoot);
  if (destination.origin !== appRoot.origin || !destination.pathname.startsWith(appRoot.pathname)) {
    destination = appRoot;
  }
  const appPrefix = appRoot.origin + appRoot.pathname;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if (client.url.startsWith(appPrefix) && 'focus' in client) {
        if (client.url !== destination.href && 'navigate' in client) client.navigate(destination.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination.href);
  }));
});
