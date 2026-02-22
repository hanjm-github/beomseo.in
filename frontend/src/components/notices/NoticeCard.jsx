import { Paperclip, Eye, Pin, AlertTriangle, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import RoleName from '../RoleName/RoleName';
import styles from './notices.module.css';

function Badge({ icon: Icon, label, tone = 'neutral' }) {
  return (
    <span className={`${styles.badge} ${styles[`badge-${tone}`]}`}>
      {Icon ? <Icon size={12} /> : null}
      {label}
    </span>
  );
}

export default function NoticeCard({ notice, to }) {
  const attachmentsCount =
    typeof notice.attachmentsCount === 'number'
      ? notice.attachmentsCount
      : Array.isArray(notice.attachments)
        ? notice.attachments.length
        : 0;

  return (
    <Link to={to} className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.titleRow}>
          {notice.pinned && <Badge icon={Pin} label="상단 고정" tone="primary" />}
          {notice.important && <Badge icon={AlertTriangle} label="중요" tone="warn" />}
          {notice.examRelated && <Badge icon={GraduationCap} label="시험" tone="info" />}
          <h3 className={styles.cardTitle}>{notice.title}</h3>
        </div>
        <div className={styles.metaRow}>
          <RoleName
            nickname={notice.author?.name || '관리자'}
            role={notice.author?.role || 'admin'}
            size="sm"
          />
          <span className={styles.metaDivider}>•</span>
          <span className={styles.meta}>{new Date(notice.createdAt).toLocaleDateString()}</span>
          {notice.views != null && (
            <>
              <span className={styles.metaDivider}>•</span>
              <span className={styles.meta}>
                <Eye size={12} />
                {notice.views}
              </span>
            </>
          )}
        </div>
      </div>
      <p className={styles.cardSummary}>{notice.summary || '본문 미리보기가 제공되지 않습니다.'}</p>
      <div className={styles.cardFooter}>
        <div className={styles.tagRow}>
          {notice.tags?.map((tag) => (
            <span key={tag} className={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
        <div className={styles.attachmentRow}>
          {attachmentsCount > 0 ? (
            <span className={styles.meta}>
              <Paperclip size={12} />
              {attachmentsCount}
            </span>
          ) : (
            <span className={styles.metaMuted}>첨부 없음</span>
          )}
        </div>
      </div>
    </Link>
  );
}
