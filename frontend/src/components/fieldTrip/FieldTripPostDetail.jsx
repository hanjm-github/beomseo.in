import Attachments from '../notices/Attachments';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';
import { formatFieldTripDate } from '../../features/fieldTrip/utils';

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
        <span>{post.nickname}</span>
        <span>•</span>
        <span>{formatFieldTripDate(post.createdAt)}</span>
      </div>

      <div className={styles.detailBody}>
        <p className={styles.detailBodyText}>{post.body}</p>
      </div>

      {post.attachments?.length ? (
        <div className={styles.detailAttachments}>
          <h3 className={styles.detailSectionTitle}>첨부 파일</h3>
          <Attachments items={post.attachments} compact />
        </div>
      ) : null}
    </section>
  );
}
