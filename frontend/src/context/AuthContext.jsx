/* eslint-disable react-refresh/only-export-components */
/**
 * Authentication Context for managing user state and auth operations.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_EXPIRED_EVENT, authApi } from '../api/auth';
import tokenStore from '../security/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is authenticated on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = tokenStore.getAccessToken();
            if (token) {
                try {
                    const data = await authApi.getMe();
                    setUser(data.user);
                } catch {
                    // Token invalid or expired - clear storage
                    tokenStore.clearTokens();
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    useEffect(() => {
        const handleAuthExpired = () => {
            tokenStore.clearTokens();
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
            tokenStore.setTokens(data.access_token, data.refresh_token);
            setUser(data.user);
            return { success: true };
        } catch (err) {
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
            tokenStore.setTokens(data.access_token, data.refresh_token);
            setUser(data.user);
            return { success: true };
        } catch (err) {
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
            tokenStore.clearTokens();
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

