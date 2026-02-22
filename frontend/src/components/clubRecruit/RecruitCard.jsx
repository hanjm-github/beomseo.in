/**
 * @file src/components/clubRecruit/RecruitCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react-router-dom
 * - ./clubRecruit.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Link } from 'react-router-dom';
import styles from './clubRecruit.module.css';

const gradeLabel = {
  lower: '1·2학년',
  upper: '3학년',
};

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function initials(name) {
  if (!name) return 'CLUB';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * RecruitCard module entry point.
 */
export default function RecruitCard({ item, basePath = '/community/club-recruit', showStatus = false }) {
  const { id, clubName, field, gradeGroup, posterUrl, extraNote, applyPeriod, status } = item;

  const dateLabel = applyPeriod?.end
    ? `${formatDate(applyPeriod.start)} ~ ${formatDate(applyPeriod.end)}`
    : applyPeriod?.start
      ? `${formatDate(applyPeriod.start)} ~ 모집 기간 미정`
      : '모집 기간 미정';

  return (
    <Link to={`${basePath}/${id}`} className={styles.card} aria-label={`${clubName} 상세 보기`}>
      <div className={styles.poster}>
        {posterUrl ? (
          <img src={posterUrl} alt={`${clubName} 포스터`} loading="lazy" />
        ) : (
          <div className={styles.posterFallback} aria-hidden="true">
            <span>{initials(clubName)}</span>
          </div>
        )}
        <span className={styles.gradeBadge}>{gradeLabel[gradeGroup] || '학년 구분'}</span>
        {showStatus ? (
          <span
            className={`${styles.statusBadge} ${
              status === 'approved' ? styles.statusApproved : styles.statusPending
            }`}
          >
            {status === 'approved' ? '승인됨' : '승인 대기'}
          </span>
        ) : null}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardChips}>
          <span className={styles.chip}>{field}</span>
        </div>
        <h3 className={styles.cardTitle}>{clubName}</h3>
        <p className={styles.cardNote}>{extraNote || '모집 정보가 곧 업데이트됩니다.'}</p>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>{dateLabel}</span>
        </div>
      </div>
    </Link>
  );
}


