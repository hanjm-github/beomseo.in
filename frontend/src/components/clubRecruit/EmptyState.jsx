import styles from './clubRecruit.module.css';

export default function EmptyState({ message = '모집 중인 동아리가 없어요.' }) {
  return <div className={styles.empty}>{message}</div>;
}
