/* global importScripts, firebase */

const FIREBASE_ENABLED = __FIREBASE_ENABLED__;
const FIREBASE_VERSION = '__FIREBASE_VERSION__';
const FIREBASE_CONFIG = __FIREBASE_CONFIG__;

function parseMenuItemsJson(rawValue) {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function buildNotificationBody(payload) {
  const menuItems = parseMenuItemsJson(payload?.data?.menuItemsJson);
  if (menuItems.length > 0) {
    return menuItems.join('\n');
  }

  return payload?.notification?.body || payload?.data?.body || '오늘의 급식을 확인해 보세요.';
}

if (!FIREBASE_ENABLED) {
  self.addEventListener('install', () => {
    self.skipWaiting();
  });
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
} else {
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
  importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || payload?.data?.title || '오늘의 급식';
    const body = payload?.notification?.body || payload?.data?.body || '오늘 급식을 확인해 보세요.';
    const link = payload?.fcmOptions?.link || payload?.data?.link || `${self.location.origin}/school-info/meal`;
    const icon = payload?.notification?.icon || payload?.data?.icon || `${self.location.origin}/pwa-192x192.png`;

    self.registration.showNotification(title, {
      body: buildNotificationBody(payload) || body,
      icon,
      badge: icon,
      data: { link },
      tag: payload?.data?.mealDate ? `school-meal-${payload.data.mealDate}` : 'school-meal',
    });
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.link || `${self.location.origin}/school-info/meal`;

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ('focus' in client && client.url === targetUrl) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
    );
  });
}
