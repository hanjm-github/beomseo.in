/**
 * Auth API utilities with axios interceptors for JWT handling.
 */
import axios from 'axios';

// API base URL - Flask backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const ISO_DATETIME_WITHOUT_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

// Create axios instance
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

// Request interceptor - add JWT token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
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
        const originalRequest = error.config;

        // If 401 and not already retrying
        if (error.response?.status === 401 && !originalRequest._retry) {
            // Check if it's a token expiry error
            if (error.response?.data?.error_code === 'token_expired') {
                originalRequest._retry = true;

                try {
                    const refreshToken = localStorage.getItem('refresh_token');
                    if (refreshToken) {
                        const response = await axios.post(
                            `${API_BASE_URL}/api/auth/refresh`,
                            {},
                            {
                                headers: {
                                    Authorization: `Bearer ${refreshToken}`,
                                },
                            }
                        );

                        const { access_token } = response.data;
                        localStorage.setItem('access_token', access_token);

                        // Retry original request with new token
                        originalRequest.headers.Authorization = `Bearer ${access_token}`;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    // Refresh failed - clear tokens and redirect to login
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            }
        }

        return Promise.reject(error);
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
