/**
 * @file src/api/auth.js
 * @description Encapsulates backend API contracts, normalization, and fallback behavior.
 * Responsibilities:
 * - Expose a stable API-facing interface for feature code while shielding transport details.
 * Key dependencies:
 * - axios
 * - ../security/tokenStore
 * Side effects:
 * - Performs HTTP requests to backend endpoints via shared API clients.
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Acts as the data boundary between UI code and backend HTTP endpoints.
 */
/**
 * Auth API utilities with axios interceptors for JWT handling.
 */
import axios from 'axios';
import tokenStore from '../security/tokenStore';

// API base URL - Flask backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ISO_DATETIME_WITHOUT_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
export const AUTH_EXPIRED_EVENT = 'auth:expired';
let refreshPromise = null;

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false,
});

function normalizeUtcDateString(value) {
    if (typeof value !== 'string') return value;
    if (!ISO_DATETIME_WITHOUT_TZ_RE.test(value)) return value;
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

function emitAuthExpired(reason = 'session_expired') {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent(AUTH_EXPIRED_EVENT, {
            detail: { reason },
        })
    );
}

function shouldSkipRefresh(requestUrl = '') {
    const authPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/logout',
    ];
    // Auth endpoints must never recursively trigger refresh logic.
    return authPaths.some((path) => requestUrl.includes(path));
}

// Request interceptor - add JWT token to requests
api.interceptors.request.use(
    (config) => {
        const token = tokenStore.getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle token refresh
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
        const status = error?.response?.status;
        const errorCode = error?.response?.data?.error_code;

        if (status !== 401) {
            return Promise.reject(error);
        }

        if (shouldSkipRefresh(requestUrl) || originalRequest._retry) {
            // For non-login/register requests, clear stale tokens so UI can return to a fresh auth state.
            if (!requestUrl.includes('/api/auth/login') && !requestUrl.includes('/api/auth/register')) {
                tokenStore.clearTokens();
                emitAuthExpired('unauthorized');
            }
            return Promise.reject(error);
        }

        if (errorCode !== 'token_expired') {
            tokenStore.clearTokens();
            emitAuthExpired('unauthorized');
            return Promise.reject(error);
        }

        const refreshToken = tokenStore.getRefreshToken();
        if (!refreshToken) {
            tokenStore.clearTokens();
            emitAuthExpired('missing_refresh_token');
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                // Serialize refresh requests so multiple concurrent 401 responses share one refresh call.
                refreshPromise = axios
                    .post(
                        `${API_BASE_URL}/api/auth/refresh`,
                        {},
                        {
                            headers: {
                                Authorization: `Bearer ${refreshToken}`,
                            },
                            withCredentials: false,
                        }
                    )
                    .then((response) => {
                        const accessToken = response?.data?.access_token;
                        const refreshToken = response?.data?.refresh_token;
                        if (!accessToken) {
                            throw new Error('Access token was not returned from refresh endpoint.');
                        }
                        tokenStore.setAccessToken(accessToken);
                        if (refreshToken) {
                            tokenStore.setRefreshToken(refreshToken);
                        }
                        return accessToken;
                    })
                    .finally(() => {
                        // Always release the lock, even on refresh failure, for future auth attempts.
                        refreshPromise = null;
                    });
            }

            const accessToken = await refreshPromise;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            // Replay the original request with the newly issued token.
            return api(originalRequest);
        } catch (refreshError) {
            tokenStore.clearTokens();
            emitAuthExpired('refresh_failed');
            return Promise.reject(refreshError);
        }
    }
);

// Auth API functions
export const authApi = {
    /**
     * Register new user
     */
    register: async (nickname, password) => {
        const response = await api.post('/api/auth/register', { nickname, password });
        return response.data;
    },

    /**
     * Login with nickname and password
     */
    login: async (nickname, password) => {
        const response = await api.post('/api/auth/login', { nickname, password });
        return response.data;
    },

    /**
     * Get current user info
     */
    getMe: async () => {
        const response = await api.get('/api/auth/me');
        return response.data;
    },

    /**
     * Logout current user
     */
    logout: async () => {
        const response = await api.post('/api/auth/logout');
        return response.data;
    },
};

export default api;


