import { Link } from 'react-router-dom';
import { Bookmark, Clock3, Sparkles, ThumbsUp, BookOpen, CheckCheck } from 'lucide-react';
import styles from './petition.module.css';

const statusLabel = {
  'needs-support': '추천 필요',
  'waiting-answer': '답변 대기',
  answered: '답변 완료',
  pending: '승인 대기',
};

const statusClass = {
  'needs-support': styles.needs,
  'waiting-answer': styles.waiting,
  answered: styles.answered,
  pending: styles.pending,
};

const deriveStatus = (item, threshold) => {
  if (!item) return 'needs-support';
  if (item.answer) return 'answered';
  const votes = item.votes || 0;
  const th = threshold || 50;
  if (votes >= th) return 'waiting-answer';
  return 'needs-support';
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function PetitionCard({
  item,
  basePath = '/community/petition',
  onVote,
  canVote,
  linkState,
  isAdmin,
}) {
  const threshold = item.threshold || 50;
  const pct = Math.min(100, Math.round(((item.votes || 0) / threshold) * 100));
  const derivedStatus = item.statusDerived || deriveStatus(item, threshold);
  const approvalLabel =
    item.status === 'approved' ? '승인됨' : item.status === 'rejected' ? '반려' : '승인 대기';

  const handleVote = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onVote) return;
    onVote(item);
  };

  return (
    <Link
      to={`${basePath}/${item.id}`}
      state={linkState}
      className={styles.card}
      aria-label={`${item.title} 상세보기`}
    >
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>

      <div className={styles.badgeRow}>
        <span className={`${styles.status} ${statusClass[derivedStatus] || ''}`}>
          <Sparkles size={14} />
          {statusLabel[derivedStatus] || '상태 미정'}
        </span>
        {isAdmin ? (
          <span className={styles.voteBadge}>
            <BookOpen size={14} />
            {approvalLabel}
          </span>
        ) : null}
        <span className={styles.voteBadge}>
          <ThumbsUp size={14} />
          {item.votes}/{threshold} 추천
        </span>
      </div>

      <h3 className={styles.title}>{item.title}</h3>
      <p className={styles.summary}>{item.summary || item.body}</p>

      <div className={styles.progressRow} aria-hidden>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
        <span className={styles.metaItem} style={{ minWidth: 60, textAlign: 'right' }}>
          {pct}% 
        </span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaItem}>
          <BookOpen size={14} />
          {item.category || '기타'}
        </span>
        <span className={styles.metaItem}>
          <Clock3 size={14} />
          {formatDate(item.createdAt)}
        </span>
        <span className={styles.metaItem}>
          <Bookmark size={14} />
          {item.author?.nickname || '익명'} {item.author?.role === 'teacher' ? '(교사)' : ''}
        </span>
        {item.answer ? (
          <span className={styles.metaItem}>
            <CheckCheck size={14} />
            답변 등록
          </span>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.voteBtn} ${item.isVotedByMe ? styles.voteActive : ''}`}
          onClick={handleVote}
          aria-pressed={!!item.isVotedByMe}
          aria-label="청원 추천"
          disabled={!canVote}
        >
          <ThumbsUp size={16} />
          {item.isVotedByMe ? '추천 취소' : '추천하기'}
        </button>
        <span className={styles.detailsLink}>상세보기</span>
      </div>
    </Link>
  );
}
