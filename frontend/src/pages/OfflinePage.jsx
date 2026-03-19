import { Home, RotateCcw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './OfflinePage.module.css';

export default function OfflinePage({ onRetry, retrying = false, compact = false }) {
  return (
    <div className={compact ? `${styles.shell} ${styles.compact}` : styles.shell}>
      <div className={styles.panel}>
        <div className={styles.badge}>
          <WifiOff size={16} />
          <span>오프라인</span>
        </div>

        <div className={styles.copy}>
          <h1 className={styles.title}>인터넷 연결을 확인해 주세요</h1>
          <p className={styles.description}>
            범서인은 현재 네트워크에 연결되어 있지 않아 필요한 정보를 불러오지 못하고 있습니다.
            연결을 확인한 뒤 다시 시도해 주세요.
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-primary ${styles.button}`}
            onClick={onRetry}
            disabled={retrying}
          >
            <RotateCcw size={16} />
            {retrying ? '연결 확인 중...' : '다시 시도'}
          </button>
          <Link className={`btn btn-secondary ${styles.button}`} to="/">
            <Home size={16} />
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
