import styles from './clubRecruit.module.css';

export default function ErrorState({ message = '데이터를 불러오지 못했습니다.', onRetry }) {
  return (
    <div className={styles.errorState}>
      <p>{message}</p>
      {onRetry ? (
        <button className={styles.retryBtn} type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}
