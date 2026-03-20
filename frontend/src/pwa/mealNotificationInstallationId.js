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

  const nextId =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : createFallbackUuid();
  window.localStorage.setItem(STORAGE_KEY, nextId);
  return nextId;
}
