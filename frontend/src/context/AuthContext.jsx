/**
 * Authentication Context for managing user state and auth operations.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is authenticated on mount
    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const data = await authApi.getMe();
                    setUser(data.user);
                } catch (err) {
                    // Token invalid or expired - clear storage
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    /**
     * Login with nickname and password
     */
    const login = useCallback(async (nickname, password) => {
        setError(null);
        try {
            const data = await authApi.login(nickname, password);
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
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
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
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
        } catch (err) {
            // Ignore logout errors
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
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

export default AuthContext;
