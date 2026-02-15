import NoticeCard from './NoticeCard';
import EmptyState from './EmptyState';
import styles from './notices.module.css';

export default function NoticeList({ items, basePath, isLoading }) {
  if (isLoading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!items?.length) {
    return <EmptyState />;
  }

  return (
    <div className={styles.listGrid}>
      {items.map((notice) => (
        <NoticeCard key={notice.id} notice={notice} to={`${basePath}/${notice.id}`} />
      ))}
    </div>
  );
}

