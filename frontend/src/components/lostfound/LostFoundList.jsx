/**
 * @file src/components/lostfound/LostFoundList.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./LostFoundCard
 * - ./lostfound.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import LostFoundCard from './LostFoundCard';
import styles from './lostfound.module.css';

/**
 * LostFoundList module entry point.
 */
export default function LostFoundList({ items, basePath, isLoading }) {
  if (isLoading) {
    return <div className={styles.placeholder}>분실물 목록을 불러오는 중입니다.</div>;
  }

  if (!items?.length) {
    return (
      <div className={styles.empty}>
        <p>조건에 맞는 분실물이 없습니다.</p>
        <p>필터를 초기화하거나 검색어를 바꿔보세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <LostFoundCard key={item.id} item={item} to={`${basePath}/${item.id}`} />
      ))}
    </div>
  );
}


