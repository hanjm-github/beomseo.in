/**
 * @file src/components/Community/ValuePick/ValuePickPostCard.jsx
 */
import { Eye, MessageCircle, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import RoleName from '../../RoleName/RoleName';
import styles from './valuepick.module.css';

function formatRelativeDate(isoString) {
  if (!isoString) return '방금 전';

  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(isoString).toLocaleDateString();
}

export default function ValuePickPostCard({ post, to }) {
  const isPending = post.status === 'pending';

  return (
    <Link to={to} className={styles.card}>
      <div className={styles.cardAccent} aria-hidden="true" />
      <div className={styles.cardBody}>
        <div className={styles.cardHeaderRow}>
          <span className={styles.competencyBadge}>인성 역량 · {post.competency || '기록 중'}</span>
          {isPending ? (
            <span className={`${styles.statusBadge} ${styles.statusPending}`}>
              <ShieldAlert size={12} />
              미승인
            </span>
          ) : null}
        </div>

        <blockquote className={styles.pledgeQuote}>{post.pledge || '아직 다짐 문장이 없어요.'}</blockquote>
        <p className={styles.cardSummary}>
          {post.bodyPreview || '상세 기록은 선택 항목이라 지금은 한 줄 다짐만 남겨져 있어요.'}
        </p>

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <RoleName nickname={post.author?.name || '작성자'} role={post.author?.role || 'student'} size="sm" />
          </span>
          <span className={styles.metaItem}>{formatRelativeDate(post.createdAt)}</span>
          <span className={styles.metaItem}>
            <Eye size={14} />
            {post.views || 0}
          </span>
          <span className={styles.metaItem}>
            <MessageCircle size={14} />
            {post.commentsCount || 0}
          </span>
          <span className={styles.metaItem}>
            <ThumbsUp size={14} />
            {post.likes || 0}
          </span>
          <span className={styles.metaItem}>
            <ThumbsDown size={14} />
            {post.dislikes || 0}
          </span>
        </div>
      </div>
    </Link>
  );
}
