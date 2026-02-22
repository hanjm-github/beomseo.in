/**
 * @file src/components/lostfound/LostFoundCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - react-router-dom
 * - ../../api/lostFound
 * - ./lostfound.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { CalendarDays, MapPin, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { lostFoundApi } from '../../api/lostFound';
import styles from './lostfound.module.css';

function formatFoundDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

/**
 * LostFoundCard module entry point.
 */
export default function LostFoundCard({ item, to }) {
  const images = Array.isArray(item.images) ? item.images : [];
  const imageCount = typeof item.imageCount === 'number' ? item.imageCount : images.length;
  const coverImage = images[0];
  const statusClass = item.status === 'found' ? styles.statusFound : styles.statusSearching;

  return (
    <Link to={to} className={styles.card} aria-label={`${item.title} 상세 보기`}>
      <div className={styles.cardImageWrap}>
        {coverImage ? (
          <img
            className={styles.cardImage}
            src={coverImage.url}
            alt={`${item.title} 분실물 사진`}
            loading="lazy"
          />
        ) : (
          <div className={styles.cardImageFallback} aria-hidden="true">
            사진 없음
          </div>
        )}
        <div className={styles.cardBadgeRow}>
          <span className={`${styles.statusBadge} ${statusClass}`}>
            {lostFoundApi.statusLabel[item.status]}
          </span>
          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <span className={styles.categoryBadge}>
              {lostFoundApi.categoryLabel[item.category] || lostFoundApi.categoryLabel.etc}
            </span>
            {imageCount > 1 ? (
              <span className={styles.categoryBadge}>+{imageCount - 1}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>{item.title}</h3>
        <div className={styles.metaGrid}>
          <span className={styles.metaItem}>
            <CalendarDays size={14} />
            습득일 {formatFoundDate(item.foundAt)}
          </span>
          <span className={styles.metaItem}>
            <MapPin size={14} />
            습득장소 {item.foundLocation}
          </span>
          <span className={styles.metaItem}>
            <PackageCheck size={14} />
            보관장소 {item.storageLocation}
          </span>
        </div>
      </div>
    </Link>
  );
}


