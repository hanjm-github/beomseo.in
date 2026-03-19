import { useEffect, useState } from 'react';
import { useNetworkStatus } from '../../context/NetworkStatusContext';
import OfflinePage from '../../pages/OfflinePage';
import styles from './OfflineGate.module.css';

export default function OfflineGate() {
  const { isOffline, recheckConnection } = useNetworkStatus();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!isOffline) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOffline]);

  if (!isOffline) {
    return null;
  }

  const handleRetry = async () => {
    if (retrying) return;

    setRetrying(true);
    try {
      await recheckConnection();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="오프라인 안내">
        <OfflinePage compact onRetry={handleRetry} retrying={retrying} />
      </div>
    </div>
  );
}
