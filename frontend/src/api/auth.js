/**
 * @file src/api/auth.js
 * @description Shared API client for cookie-based auth.
 * - Sends credentials (HttpOnly cookies) on every request.
 * - Adds CSRF header for state-changing requests.
 * - Retries once after token expiry via /api/auth/refresh.
 * - Emits `auth:expired` when session recovery fails.
 * - Emits `app:network-request-failed` so the offline overlay can react to transport errors.
 */
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import { emitNetworkRequestFailure } from '../pwa/events';

const ISO_DATETIME_WITHOUT_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
const SAFE_METHODS = new Set(['get', 'head', 'options']);
const CSRF_ACCESS_COOKIE = 'csrf_access_token';
const CSRF_REFRESH_COOKIE = 'csrf_refresh_token';

export const AUTH_EXPIRED_EVENT = 'auth:expired';
// Single-flight lock so concurrent 401s trigger only one refresh request.
let refreshPromise = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

function normalizeUtcDateString(value) {
  if (typeof value !== 'string') return value;
  if (!ISO_DATETIME_WITHOUT_TZ_RE.test(value)) return value;
  // Backend may return naive ISO datetime strings; normalize to UTC for consistent parsing.
  return `${value}Z`;
}

function normalizeResponseDates(payload) {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeResponseDates(item));
  }
  if (payload && typeof payload === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(payload)) {
      normalized[key] = normalizeResponseDates(value);
    }
    return normalized;
  }
  return normalizeUtcDateString(payload);
}

function readCookie(name) {
  if (typeof document === 'undefined') return '';
  // Escape cookie key for safe RegExp construction.
  const escapedName = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function getCsrfTokenForRequest(requestUrl = '', method = 'get') {
  const normalizedMethod = String(method || 'get').toLowerCase();
  // CSRF is required only for unsafe methods.
  if (SAFE_METHODS.has(normalizedMethod)) return '';
  // Refresh endpoint uses refresh CSRF cookie, others use access CSRF cookie.
  const isRefreshRequest = requestUrl.includes('/api/auth/refresh');
  return readCookie(isRefreshRequest ? CSRF_REFRESH_COOKIE : CSRF_ACCESS_COOKIE);
}

function emitAuthExpired(reason = 'session_expired') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, {
      detail: { reason },
    })
  );
}

function shouldSkipRefresh(requestUrl = '') {
  // Login/register/refresh endpoints must not trigger recursive refresh.
  const authPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
  return authPaths.some((path) => requestUrl.includes(path));
}

function isLogoutRequest(requestUrl = '') {
  return requestUrl.includes('/api/auth/logout');
}

function isAnonymousSessionProbe(requestUrl = '', errorCode = '') {
  // Initial unauthenticated /me probe should not raise global session-expired UI.
  return requestUrl.includes('/api/auth/me') && errorCode === 'authorization_required';
}

function isNetworkFailure(error) {
  return !error?.response && error?.code !== 'ERR_CANCELED';
}

api.interceptors.request.use(
  (config) => {
    const requestUrl = config?.url || '';
    const requestMethod = config?.method || 'get';

    const csrfToken = getCsrfTokenForRequest(requestUrl, requestMethod);
    if (csrfToken) {
      // Flask-JWT-Extended double-submit CSRF header.
      config.headers['X-CSRF-TOKEN'] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response?.data && typeof response.data === 'object') {
      response.data = normalizeResponseDates(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error?.config || {};
    const requestUrl = originalRequest.url || '';
    const isLogoutAttempt = isLogoutRequest(requestUrl);

    if (isNetworkFailure(error)) {
      // NetworkStatusContext listens for this event and decides whether the global offline overlay should open.
      emitNetworkRequestFailure({
        client: 'auth',
        method: originalRequest.method,
        url: requestUrl,
      });
      return Promise.reject(error);
    }

    const status = error?.response?.status;
    const errorCode = error?.response?.data?.error_code;

    if (status !== 401) {
      return Promise.reject(error);
    }

    if (isAnonymousSessionProbe(requestUrl, errorCode)) {
      return Promise.reject(error);
    }

    if (shouldSkipRefresh(requestUrl) || originalRequest._retry) {
      if (!isLogoutAttempt && !requestUrl.includes('/api/auth/login') && !requestUrl.includes('/api/auth/register')) {
        emitAuthExpired('unauthorized');
      }
      return Promise.reject(error);
    }

    if (errorCode !== 'token_expired') {
      if (!isLogoutAttempt) {
        emitAuthExpired('unauthorized');
      }
      return Promise.reject(error);
    }

    // Retry once after successful refresh.
    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        const refreshHeaders = {};
        const refreshCsrf = getCsrfTokenForRequest('/api/auth/refresh', 'post');
        if (refreshCsrf) {
          refreshHeaders['X-CSRF-TOKEN'] = refreshCsrf;
        }

        refreshPromise = axios
          .post(`${API_BASE_URL}/api/auth/refresh`, {}, { headers: refreshHeaders, withCredentials: true })
          .finally(() => {
            refreshPromise = null;
          });
      }

      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      if (!isLogoutAttempt) {
        emitAuthExpired('refresh_failed');
      }
      return Promise.reject(refreshError);
    }
  }
);

export const authApi = {
  register: async (nickname, password) => {
    const response = await api.post('/api/auth/register', { nickname, password });
    return response.data;
  },

  login: async (nickname, password) => {
    const response = await api.post('/api/auth/login', { nickname, password });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },
};

export default api;
