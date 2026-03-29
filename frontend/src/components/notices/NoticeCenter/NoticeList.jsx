/**
 * @file src/components/notices/NoticeCenter/NoticeList.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./NoticeCard
 * - ./EmptyState
 * - ./notices.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import NoticeCard from './NoticeCard';
import EmptyState from './EmptyState';
import styles from './notices.module.css';

/**
 * NoticeList module entry point.
 */
export default function NoticeList({ items, basePath, isLoading, emptyStateProps, cardProps }) {
  if (isLoading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!items?.length) {
    // Budget board pages override the empty-state copy/path while the default
    // notice boards can keep their route-derived behavior.
    return <EmptyState {...emptyStateProps} />;
  }

  return (
    <div className={styles.listGrid}>
      {items.map((notice) => (
        // Shared notice cards stay reusable by letting callers hide budget-
        // incompatible chrome instead of forking the whole list component.
        <NoticeCard key={notice.id} notice={notice} to={`${basePath}/${notice.id}`} {...cardProps} />
      ))}
    </div>
  );
}



