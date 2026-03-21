/**
 * @file src/context/AuthContext.jsx
 * @description Stores the authenticated user and exposes session actions to the entire SPA.
 * Responsibilities:
 * - Bootstrap the current session from auth cookies.
 * - Expose login, registration, logout, and auth-expired recovery helpers.
 * Key dependencies:
 * - react
 * - ../api/auth
 * - ../analytics/zaraz
 * Side effects:
 * - Listens for global auth-expired events emitted by the Axios auth client.
 * Role in app flow:
 * - Single source of truth for session-aware UI.
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_EXPIRED_EVENT, authApi } from '../api/auth';
import { trackAuthFailure, trackAuthSuccess } from '../analytics/zaraz';

const AuthContext = createContext(null);

/**
 * Authentication context for session state and auth mutations.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Bootstrap the session once from the cookie-backed /me endpoint.
        const initAuth = async () => {
            try {
                const data = await authApi.getMe();
                setUser(data.user);
            } catch {
                setUser(null);
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    useEffect(() => {
        // auth.js dispatches this event after refresh recovery fails.
        const handleAuthExpired = () => {
            setUser(null);
            setError('세션이 만료되었습니다. 다시 로그인해주세요.');
        };

        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        return () => {
            window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        };
    }, []);

    const login = useCallback(async (nickname, password) => {
        setError(null);
        try {
            const data = await authApi.login(nickname, password);
            setUser(data.user);
            trackAuthSuccess({
                eventName: 'login',
                userRole: data?.user?.role,
            });
            return { success: true };
        } catch (err) {
            trackAuthFailure({
                eventName: 'login_failed',
                errorType: err,
            });
            const message = err.response?.data?.error || '로그인에 실패했습니다.';
            setError(message);
            return { success: false, error: message };
        }
    }, []);

    const register = useCallback(async (nickname, password) => {
        setError(null);
        try {
            const data = await authApi.register(nickname, password);
            setUser(data.user);
            trackAuthSuccess({
                eventName: 'sign_up',
                userRole: data?.user?.role,
            });
            return { success: true };
        } catch (err) {
            trackAuthFailure({
                eventName: 'sign_up_failed',
                errorType: err,
            });
            const message = err.response?.data?.error || '회원가입에 실패했습니다.';
            setError(message);
            return { success: false, error: message };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Local session state should still be cleared even if the server logout request fails.
        } finally {
            setUser(null);
            setError(null);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const value = {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        clearError,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
