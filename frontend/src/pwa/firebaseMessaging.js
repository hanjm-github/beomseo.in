import { FIREBASE_CONFIG, FIREBASE_MESSAGING_ENABLED, FIREBASE_VAPID_KEY } from '../config/env';


const FIREBASE_MESSAGING_SCOPE = '/firebase-push-scope';
const FIREBASE_MESSAGING_SW_URL = '/firebase-messaging-sw.js';

let firebaseMessagingContextPromise = null;
let firebaseForegroundListenerStarted = false;
let firebaseMessagingSupportPromise = null;


function buildUnsupportedError(message = 'unsupported') {
  const error = new Error(message);
  error.code = message;
  return error;
}


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

  return payload?.notification?.body || payload?.data?.body || '?ㅻ뒛 湲됱떇???뺤씤??蹂댁꽭??';
}


function extractNotificationPayload(payload) {
  const title = payload?.notification?.title || payload?.data?.title || '오늘의 급식';
  const body = payload?.notification?.body || payload?.data?.body || '오늘 급식을 확인해 보세요.';
  const link = payload?.fcmOptions?.link || payload?.data?.link || '/school-info/meal';
  const icon = payload?.notification?.icon || payload?.data?.icon || '/pwa-192x192.png';

  return { title, body: buildNotificationBody(payload) || body, link, icon };
}


function showForegroundNotification(payload) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const { title, body, link, icon } = extractNotificationPayload(payload);
  const notification = new Notification(title, {
    body,
    icon,
    badge: icon,
    tag: payload?.data?.mealDate ? `school-meal-${payload.data.mealDate}` : 'school-meal',
  });

  notification.onclick = () => {
    window.focus();
    window.location.assign(link);
  };
}


export function isFirebaseMessagingConfigured() {
  return FIREBASE_MESSAGING_ENABLED;
}


export function getBrowserNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}


export async function isFirebaseMessagingSupported() {
  if (firebaseMessagingSupportPromise) {
    return firebaseMessagingSupportPromise;
  }

  firebaseMessagingSupportPromise = (async () => {
    if (!FIREBASE_MESSAGING_ENABLED) return false;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

    const messagingModule = await import('firebase/messaging');
    return messagingModule.isSupported();
  })().catch(() => false);

  return firebaseMessagingSupportPromise;
}


async function getFirebaseMessagingContext() {
  if (firebaseMessagingContextPromise) {
    return firebaseMessagingContextPromise;
  }

  firebaseMessagingContextPromise = (async () => {
    const supported = await isFirebaseMessagingSupported();
    if (!supported) {
      throw buildUnsupportedError();
    }

    const [{ getApp, getApps, initializeApp }, messagingModule] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);

    const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      FIREBASE_MESSAGING_SW_URL,
      { scope: FIREBASE_MESSAGING_SCOPE }
    );

    return {
      messaging: messagingModule.getMessaging(app),
      messagingModule,
      serviceWorkerRegistration,
    };
  })().catch((error) => {
    firebaseMessagingContextPromise = null;
    throw error;
  });

  return firebaseMessagingContextPromise;
}


export async function getCurrentFirebaseMessagingToken() {
  if (!FIREBASE_MESSAGING_ENABLED) return '';
  if (getBrowserNotificationPermission() !== 'granted') return '';

  const context = await getFirebaseMessagingContext();
  return context.messagingModule.getToken(context.messaging, {
    vapidKey: FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: context.serviceWorkerRegistration,
  });
}


export async function requestFirebaseMessagingPermissionAndToken() {
  if (!FIREBASE_MESSAGING_ENABLED) {
    throw buildUnsupportedError('not-configured');
  }
  if (typeof Notification === 'undefined') {
    throw buildUnsupportedError();
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    const error = buildUnsupportedError(
      permission === 'denied' ? 'notifications-denied' : 'notifications-dismissed'
    );
    throw error;
  }

  const token = await getCurrentFirebaseMessagingToken();
  if (!token) {
    throw new Error('Unable to create Firebase messaging token.');
  }

  return token;
}


export async function deleteCurrentFirebaseMessagingToken() {
  if (!FIREBASE_MESSAGING_ENABLED) return false;

  const supported = await isFirebaseMessagingSupported();
  if (!supported) return false;

  const context = await getFirebaseMessagingContext();
  return context.messagingModule.deleteToken(context.messaging);
}


export async function startFirebaseForegroundMessageListener() {
  if (firebaseForegroundListenerStarted || !FIREBASE_MESSAGING_ENABLED) {
    return;
  }

  const supported = await isFirebaseMessagingSupported();
  if (!supported) return;

  const context = await getFirebaseMessagingContext();
  context.messagingModule.onMessage(context.messaging, (payload) => {
    showForegroundNotification(payload);
  });
  firebaseForegroundListenerStarted = true;
}
