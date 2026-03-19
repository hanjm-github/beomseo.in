import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export const FASTAPI_BASE_URL = (
  import.meta.env.VITE_SPORTS_LEAGUE_API_URL || API_BASE_URL
).replace(/\/$/, '');

const SAFE_METHODS = new Set(['get', 'head', 'options']);
const AUTH_CSRF_COOKIE = 'csrf_access_token';

export function readCookie(name) {
  if (typeof document === 'undefined') return '';
  const escapedName = name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export const fastapiApi = axios.create({
  baseURL: FASTAPI_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

fastapiApi.interceptors.request.use((config) => {
  if (!SAFE_METHODS.has((config.method || 'get').toLowerCase())) {
    const authCsrf = readCookie(AUTH_CSRF_COOKIE);
    if (authCsrf) {
      config.headers['X-CSRF-TOKEN'] = authCsrf;
    }
  }
  return config;
});
