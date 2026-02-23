/**
 * @file src/context/AuthContext.jsx
 * @description Defines React context state and helper hooks shared across the app.
 * Responsibilities:
 * - Own shared cross-route state and lifecycle hooks consumed by descendant components.
 * Key dependencies:
 * - react
 * - ../api/auth
 * - ../analytics/zaraz
 * Side effects:
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Supplies cross-cutting state to page and component layers during runtime.
 */
/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context for managing user state and auth operations.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_EXPIRED_EVENT, authApi } from '../api/auth';
import { trackAuthFailure, trackAuthSuccess } from '../analytics/zaraz';

const AuthContext = createContext(null);

/**
 * AuthProvider module entry point.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is authenticated on mount
    useEffect(() => {
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
        const handleAuthExpired = () => {
            setUser(null);
            setError('세션이 만료되었습니다. 다시 로그인해주세요.');
        };

        window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        return () => {
            window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
        };
    }, []);

    /**
     * Login with nickname and password
     */
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

    /**
     * Register new user
     */
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

    /**
     * Logout current user
     */
    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore logout errors
        } finally {
            setUser(null);
            setError(null);
        }
    }, []);

    /**
     * Clear error state
     */
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

/**
 * Hook to access auth context
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}



