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

export default function GomsolMarketCard({ item, to, isAdmin }) {
  const coverImage = item.images?.[0];
  const statusClass = item.status === 'sold' ? styles.statusSold : styles.statusSelling;
  const approvalClass = item.approvalStatus === 'approved' ? styles.approvalApproved : styles.approvalPending;

  return (
    <Link to={to} className={styles.card} aria-label={`${item.title} 상세 보기`}>
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
          <span className={styles.categoryBadge}>
            {gomsolMarketApi.categoryLabel[item.category] || gomsolMarketApi.categoryLabel.etc}
          </span>
        </div>
        {isAdmin ? (
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
    </Link>
  );
}
