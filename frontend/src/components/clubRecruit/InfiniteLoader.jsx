import styles from './clubRecruit.module.css';

export default function InfiniteLoader({ message = '불러오는 중...' }) {
  return (
    <div className={styles.loader}>
      <div className={styles.spinner} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
