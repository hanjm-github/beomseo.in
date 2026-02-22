/**
 * @file src/components/vote/VoteCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - react-router-dom
 * - ./vote.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Clock3, Percent, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './vote.module.css';

const formatDateTime = (iso) => {
  if (!iso) return '마감 없음';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '마감 없음';
  return date.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * VoteCard module entry point.
 */
export default function VoteCard({ post, to }) {
  const sortedOptions = [...(post.options || [])].sort((a, b) => b.votes - a.votes);
  const leadOption = sortedOptions[0];
  const previewOptions = sortedOptions.slice(0, 3);

  return (
    <Link to={to} className={styles.card} aria-label={`${post.title} 상세 보기`}>
      <div className={styles.cardHeader}>
        <span className={`${styles.statusBadge} ${post.status === 'open' ? styles.statusOpen : styles.statusClosed}`}>
          {post.status === 'open' ? '진행중' : '마감'}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          <Percent size={14} style={{ verticalAlign: 'text-bottom' }} /> 1위 {leadOption?.pct ?? 0}%
        </span>
      </div>

      <h3 className={styles.cardTitle}>{post.title}</h3>
      <p className={styles.cardDesc}>{post.description || '설명 없음'}</p>

      <div className={styles.cardLeadBar} aria-label="선두 선택지 비율">
        <div className={styles.cardLeadFill} style={{ width: `${leadOption?.pct ?? 0}%` }} />
      </div>

      <div className={styles.optionMini}>
        {previewOptions.map((option) => (
          <div className={styles.optionMiniRow} key={option.id}>
            <span className={styles.optionMiniText}>{option.text}</span>
            <span className={styles.optionMiniPct}>{option.pct}%</span>
            <div className={styles.optionMiniTrack}>
              <div className={styles.optionMiniFill} style={{ width: `${option.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.cardMeta}>
        <span>
          <Users size={14} style={{ verticalAlign: 'text-bottom' }} /> 총 {post.totalVotes}명 참여
        </span>
        <span>
          <Clock3 size={14} style={{ verticalAlign: 'text-bottom' }} /> {formatDateTime(post.closesAt)}
        </span>
      </div>
    </Link>
  );
}



