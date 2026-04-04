/**
 * @file src/pwa/mealNotificationInstallationId.js
 * @description Persists a device-scoped identifier for meal reminders.
 * The backend stores notification preferences by installationId so the same
 * signed-in user can manage multiple browsers or installed PWAs independently.
 */
const STORAGE_KEY = 'meal-notification-installation-id';


function createFallbackUuid() {
  return `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}


export function getMealNotificationInstallationId() {
  if (typeof window === 'undefined') return '';

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }

  // Prefer the browser UUID API so reinstall/refresh flows do not invent a
  // custom identifier format when native support is available.
  const nextId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : createFallbackUuid();
  window.localStorage.setItem(STORAGE_KEY, nextId);
  return nextId;
}
