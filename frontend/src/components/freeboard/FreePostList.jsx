/**
 * @file src/components/freeboard/FreePostList.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./FreePostCard
 * - ./freeboard.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import FreePostCard from './FreePostCard';
import styles from './freeboard.module.css';

/**
 * FreePostList module entry point.
 */
export default function FreePostList({ items, basePath, isLoading }) {
  if (isLoading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!items || items.length === 0) {
    return <div className={styles.empty}>아직 글이 없어요. 첫 글을 작성해보세요!</div>;
  }

  return (
    <div className={styles.listGrid}>
      {items.map((post) => (
        <FreePostCard key={post.id} post={post} to={`${basePath}/${post.id}`} />
      ))}
    </div>
  );
}


