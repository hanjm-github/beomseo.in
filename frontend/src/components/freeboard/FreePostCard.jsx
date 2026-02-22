import { MessageCircle, Eye, Heart, Paperclip, Flame, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './freeboard.module.css';
import { communityApi } from '../../api/community';
import RoleName from '../RoleName/RoleName';

const formatRelative = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString();
};

const categoryTone = {
  chat: styles.badgeChat,
  info: styles.badgeInfo,
  qna: styles.badgeQna,
};

export default function FreePostCard({ post, to }) {
  const hot = (post.likes || 0) + (post.commentsCount || 0) >= 20;
  const badgeClass = categoryTone[post.category] || styles.badgeInfo;
  const attachmentsCount =
    typeof post.attachmentsCount === 'number'
      ? post.attachmentsCount
      : Array.isArray(post.attachments)
        ? post.attachments.length
        : 0;

  const authorName = post.author?.name || '작성자';
  const authorRole = post.author?.role || 'student';
  const isPending = post.status === 'pending';

  return (
    <Link to={to} className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <span className={`${styles.badge} ${badgeClass}`}>{communityApi.categoryLabel[post.category]}</span>
          {isPending ? (
            <span className={`${styles.badge} ${styles.badgePending}`}>
              <ShieldAlert size={12} />
              미승인
            </span>
          ) : null}
          {hot ? (
            <span className={`${styles.badge} ${styles.badgeHot}`}>
              <Flame size={12} />
              HOT
            </span>
          ) : null}
          <h3 className={styles.cardTitle}>{post.title}</h3>
        </div>
        <p className={styles.cardSummary}>{post.summary || '내용 미리보기가 없습니다.'}</p>
        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <RoleName nickname={authorName} role={authorRole} size="sm" />
          </span>
          <span className={styles.metaItem}>{formatRelative(post.createdAt)}</span>
          <span className={styles.metaItem}>
            <Eye size={14} />
            {post.views || 0}
          </span>
          <span className={styles.metaItem}>
            <MessageCircle size={14} />
            {post.commentsCount || 0}
          </span>
          <span className={styles.metaItem}>
            <Heart size={14} />
            {post.likes || 0}
          </span>
          {attachmentsCount > 0 ? (
            <span className={styles.metaItem}>
              <Paperclip size={14} />
              {attachmentsCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
