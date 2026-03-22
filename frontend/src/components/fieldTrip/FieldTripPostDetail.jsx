import Attachments from '../notices/Attachments';
import RoleName from '../RoleName/RoleName';
import { sanitizeRichHtml } from '../../security/htmlSanitizer';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';
import { formatFieldTripDate } from '../../features/fieldTrip/utils';

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return '0MB';
  }

  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

export default function FieldTripPostDetail({ classSummary, post, loading }) {
  if (loading) {
    return (
      <section className={`${styles.sectionCard} ${styles.sidePanel}`}>
        <div className={styles.inlineState}>게시글 상세를 불러오는 중입니다.</div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className={`${styles.sectionCard} ${styles.sidePanel}`}>
        <div className={styles.emptyCard}>
          게시글을 찾을 수 없습니다. 목록으로 돌아가 다른 현장 기록을 선택해 주세요.
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.sectionCard} ${styles.sidePanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.sectionEyebrow}>{classSummary.label} 상세</p>
          <h2 className={styles.sectionTitle}>{post.title}</h2>
        </div>
      </div>

      <div className={styles.detailMeta}>
        <RoleName nickname={post.nickname} role={post.authorRole || 'student'} size="sm" />
        <span>·</span>
        <span>{formatFieldTripDate(post.createdAt)}</span>
      </div>

      <div className={styles.detailBody}>
        <div
          className={styles.detailBodyRich}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(post.body) }}
        />
      </div>

      {post.videoAttachment ? (
        <div className={styles.detailVideoSection}>
          <h3 className={styles.detailSectionTitle}>첨부 영상</h3>
          <div className={styles.detailVideoCard}>
            <video
              className={styles.detailVideoPlayer}
              controls
              preload="metadata"
              src={post.videoAttachment.url}
            />
            <div className={styles.detailVideoMeta}>
              <span>{post.videoAttachment.name}</span>
              <span>
                {formatFileSize(post.videoAttachment.size)} · {post.videoAttachment.mime}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {post.attachments?.length ? (
        <div className={styles.detailAttachments}>
          <h3 className={styles.detailSectionTitle}>첨부 파일</h3>
          <Attachments items={post.attachments} compact />
        </div>
      ) : null}
    </section>
  );
}
