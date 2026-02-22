/**
 * @file src/components/gomsolmarket/GomsolMarketCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - react-router-dom
 * - ../../api/gomsolMarket
 * - ./gomsolmarket.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { CalendarDays, CircleDollarSign, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { gomsolMarketApi } from '../../api/gomsolMarket';
import styles from './gomsolmarket.module.css';

function formatPrice(price) {
  const safe = Number(price) || 0;
  return `${new Intl.NumberFormat('ko-KR').format(safe)}원`;
}

function formatDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

/**
 * GomsolMarketCard module entry point.
 */
export default function GomsolMarketCard({ item, to, showApproval = false }) {
  const images = Array.isArray(item.images) ? item.images : [];
  const imageCount = typeof item.imageCount === 'number' ? item.imageCount : images.length;
  const coverImage = images[0];
  const statusClass = item.status === 'sold' ? styles.statusSold : styles.statusSelling;
  const approvalClass = item.approvalStatus === 'approved' ? styles.approvalApproved : styles.approvalPending;

  const content = (
    <>
      <div className={styles.cardImageWrap}>
        {coverImage ? (
          <img
            src={coverImage.url}
            alt={`${item.title} 상품 이미지`}
            className={styles.cardImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImageFallback} aria-hidden="true">
            이미지 없음
          </div>
        )}
        <div className={styles.cardBadgeRow}>
          <span className={`${styles.statusBadge} ${statusClass}`}>
            {gomsolMarketApi.statusLabel[item.status]}
          </span>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <span className={styles.categoryBadge}>
              {gomsolMarketApi.categoryLabel[item.category] || gomsolMarketApi.categoryLabel.etc}
            </span>
            {imageCount > 1 ? (
              <span className={styles.categoryBadge}>+{imageCount - 1}</span>
            ) : null}
          </div>
        </div>
        {showApproval ? (
          <div className={styles.adminBadgeWrap}>
            <span className={`${styles.approvalBadge} ${approvalClass}`}>
              <ShieldCheck size={12} />
              {gomsolMarketApi.approvalLabel[item.approvalStatus]}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <p className={styles.price}>
          <CircleDollarSign size={15} />
          {formatPrice(item.price)}
        </p>
        <div className={styles.metaGrid}>
          <span className={styles.metaItem}>
            <CalendarDays size={14} />
            등록일 {formatDate(item.createdAt)}
          </span>
        </div>
      </div>
    </>
  );

  if (!to) {
    return (
      <article className={`${styles.card} ${styles.cardStatic}`} aria-label={`${item.title} 요약`}>
        {content}
      </article>
    );
  }

  return (
    <Link to={to} className={styles.card} aria-label={`${item.title} 상세 보기`}>
      {content}
    </Link>
  );
}


