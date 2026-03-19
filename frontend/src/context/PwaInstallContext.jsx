/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const PwaInstallContext = createContext(undefined);

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIosSafariBrowser() {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent || '';
  const isIosDevice =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  const isSafariBrowser = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);

  return isIosDevice && isSafariBrowser;
}

function subscribeMediaQuery(queryList, callback) {
  if (typeof queryList.addEventListener === 'function') {
    queryList.addEventListener('change', callback);
    return () => queryList.removeEventListener('change', callback);
  }

  queryList.addListener(callback);
  return () => queryList.removeListener(callback);
}

export function PwaInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneDisplayMode());
  const [dismissed, setDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const isIosManualInstall = !isInstalled && isIosSafariBrowser();
  const canInstall = Boolean(deferredPrompt) && !isInstalled;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    const syncInstalledState = () => {
      const nextInstalled = isStandaloneDisplayMode();
      setIsInstalled(nextInstalled);
      if (nextInstalled) {
        setDeferredPrompt(null);
        setDismissed(false);
        setHelpOpen(false);
      }
    };

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setDismissed(false);
      setHelpOpen(false);
    };

    syncInstalledState();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    const unsubscribeMediaQuery = subscribeMediaQuery(displayModeQuery, syncInstalledState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      unsubscribeMediaQuery();
    };
  }, []);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  const promptInstall = useCallback(async () => {
    if (isInstalled) {
      return 'accepted';
    }

    if (isIosManualInstall) {
      setHelpOpen(true);
      return 'manual';
    }

    if (!deferredPrompt || typeof deferredPrompt.prompt !== 'function') {
      return 'unsupported';
    }

    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);

    await promptEvent.prompt();
    const choiceResult = await promptEvent.userChoice;
    const accepted = choiceResult?.outcome === 'accepted';

    setDismissed(!accepted);
    if (accepted) {
      setHelpOpen(false);
    }

    return accepted ? 'accepted' : 'dismissed';
  }, [deferredPrompt, isInstalled, isIosManualInstall]);

  const value = useMemo(
    () => ({
      canInstall,
      isInstalled,
      isIosManualInstall,
      promptInstall,
      dismissed,
      helpOpen,
      closeHelp,
    }),
    [canInstall, closeHelp, dismissed, helpOpen, isInstalled, isIosManualInstall, promptInstall]
  );

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext);
  if (context === undefined) {
    throw new Error('usePwaInstall must be used within a PwaInstallProvider');
  }
  return context;
}
