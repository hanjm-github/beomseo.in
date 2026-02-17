import { CalendarDays, MapPin, PackageCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { lostFoundApi } from '../../api/lostFound';
import styles from './lostfound.module.css';

function formatFoundDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

export default function LostFoundCard({ item, to }) {
  const coverImage = item.images?.[0];
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
          <span className={styles.categoryBadge}>
            {lostFoundApi.categoryLabel[item.category] || lostFoundApi.categoryLabel.etc}
          </span>
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
