// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

// Guard against duplicate initialization on SW reload
if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: 'AIzaSyBnrlcpgLQYtuj97mA6Jif9Kvf2dOYLOAw',
    authDomain: 'synergo-75ffb.firebaseapp.com',
    projectId: 'synergo-75ffb',
    storageBucket: 'synergo-75ffb.firebasestorage.app',
    messagingSenderId: '590516252204',
    appId: '1:590516252204:web:db422a24b12c428e212b89',
  });
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Guildly';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/favicon.ico',
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
