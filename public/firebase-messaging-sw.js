// Firebase Messaging Service Worker
// This runs in the background to handle push notifications when the app is not in focus.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBnrlcpgLQYtuj97mA6Jif9Kvf2dOYLOAw',
  authDomain: 'synergo-75ffb.firebaseapp.com',
  projectId: 'synergo-75ffb',
  storageBucket: 'synergo-75ffb.firebasestorage.app',
  messagingSenderId: '590516252204',
  appId: '1:590516252204:web:db422a24b12c428e212b89',
});

const messaging = firebase.messaging();

// Handle background messages (app not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'Guildly';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/favicon.ico',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
