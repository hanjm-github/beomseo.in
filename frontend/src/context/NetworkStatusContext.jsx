/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/env';
import { NETWORK_REQUEST_FAILED_EVENT } from '../pwa/events';

const HEALTH_CHECK_TIMEOUT_MS = 4500;
const NetworkStatusContext = createContext(undefined);

function buildHealthCheckUrl() {
  return `${API_BASE_URL}/api/health`;
}

export function NetworkStatusProvider({ children }) {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    return navigator.onLine === false;
  });
  const [lastSource, setLastSource] = useState(() => {
    if (typeof navigator === 'undefined') return 'browser';
    return navigator.onLine === false ? 'browser' : 'manual-check';
  });

  const markOffline = useCallback((source) => {
    setIsOffline(true);
    setLastSource(source);
  }, []);

  const markOnline = useCallback((source) => {
    setIsOffline(false);
    setLastSource(source);
  }, []);

  const recheckConnection = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(buildHealthCheckUrl(), {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      });

      const isHealthy = response.ok;
      if (isHealthy) {
        markOnline('manual-check');
      } else {
        markOffline('manual-check');
      }
      return isHealthy;
    } catch {
      markOffline('manual-check');
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [markOffline, markOnline]);

  useEffect(() => {
    const handleBrowserOffline = () => {
      markOffline('browser');
    };

    const handleBrowserOnline = () => {
      void recheckConnection();
    };

    const handleRequestFailure = () => {
      markOffline('request-failure');
    };

    window.addEventListener('offline', handleBrowserOffline);
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener(NETWORK_REQUEST_FAILED_EVENT, handleRequestFailure);

    return () => {
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener(NETWORK_REQUEST_FAILED_EVENT, handleRequestFailure);
    };
  }, [markOffline, recheckConnection]);

  const value = useMemo(
    () => ({
      isOffline,
      lastSource,
      recheckConnection,
    }),
    [isOffline, lastSource, recheckConnection]
  );

  return <NetworkStatusContext.Provider value={value}>{children}</NetworkStatusContext.Provider>;
}

export function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (context === undefined) {
    throw new Error('useNetworkStatus must be used within a NetworkStatusProvider');
  }
  return context;
}
