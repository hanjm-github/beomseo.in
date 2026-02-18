const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGet(key) {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function safeRemove(key) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

export const tokenStore = {
  getAccessToken() {
    return safeGet(ACCESS_TOKEN_KEY);
  },

  getRefreshToken() {
    return safeGet(REFRESH_TOKEN_KEY);
  },

  setAccessToken(accessToken) {
    safeSet(ACCESS_TOKEN_KEY, accessToken || null);
  },

  setRefreshToken(refreshToken) {
    safeSet(REFRESH_TOKEN_KEY, refreshToken || null);
  },

  setTokens(accessToken, refreshToken) {
    safeSet(ACCESS_TOKEN_KEY, accessToken || null);
    safeSet(REFRESH_TOKEN_KEY, refreshToken || null);
  },

  clearTokens() {
    safeRemove(ACCESS_TOKEN_KEY);
    safeRemove(REFRESH_TOKEN_KEY);
  },
};

export default tokenStore;
