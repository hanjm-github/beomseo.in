/**
 * @file src/components/gomsolmarket/GomsolMarketList.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./GomsolMarketCard
 * - ./gomsolmarket.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import GomsolMarketCard from './GomsolMarketCard';
import styles from './gomsolmarket.module.css';

/**
 * GomsolMarketList module entry point.
 */
export default function GomsolMarketList({ items, basePath, isLoading, isAdmin, viewerId, canViewDetail = true }) {
  if (isLoading) {
    return <div className={styles.placeholder}>곰솔마켓 목록을 불러오는 중입니다.</div>;
  }

  if (!items?.length) {
    return (
      <div className={styles.empty}>
        <p>조건에 맞는 상품이 없습니다.</p>
        <p>필터를 초기화하거나 다른 키워드를 입력해 보세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <GomsolMarketCard
          key={item.id}
          item={item}
          to={canViewDetail ? `${basePath}/${item.id}` : null}
          showApproval={
            isAdmin || Boolean(viewerId && item.author?.id && String(viewerId) === String(item.author.id))
          }
        />
      ))}
    </div>
  );
}


