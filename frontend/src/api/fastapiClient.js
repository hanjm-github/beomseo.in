/**
 * @file src/api/fastapiClient.js
 * @description Shared Axios client for FastAPI-hosted feature areas.
 * - Targets the configurable FastAPI origin used by sports league, field trip,
 *   and meal-related features.
 * - Reuses cookie auth and CSRF semantics without sharing the auth refresh lock.
 * - Emits transport-failure events so the global offline UX can react.
 */
import axios from 'axios';
import { API_BASE_URL, FASTAPI_BASE_URL } from '../config/env';
import { emitNetworkRequestFailure } from '../pwa/events';

export { FASTAPI_BASE_URL };

// Field-trip uploads and sports-league data can live on the FastAPI origin
// even when the rest of the app still talks to the main Flask backend.
const SAFE_METHODS = new Set(['get', 'head', 'options']);
const AUTH_CSRF_COOKIE = 'csrf_access_token';

export function readCookie(name) {
  if (typeof document === 'undefined') return '';
  // Cookie names may contain characters that are significant in RegExp syntax.
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
    // FastAPI shares the auth-cookie CSRF contract with Flask, so authenticated
    // writes can reuse the same access-token CSRF cookie automatically.
    const authCsrf = readCookie(AUTH_CSRF_COOKIE);
    if (authCsrf) {
      config.headers['X-CSRF-TOKEN'] = authCsrf;
    }
  }
  return config;
});

fastapiApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error?.config || {};

    if (!error?.response && error?.code !== 'ERR_CANCELED') {
      // FastAPI requests participate in the same offline-detection channel as
      // the main auth client so pages do not need feature-specific fallback UX.
      emitNetworkRequestFailure({
        client: 'fastapi',
        method: originalRequest.method,
        url: originalRequest.url,
      });
    }

    return Promise.reject(error);
  }
);
