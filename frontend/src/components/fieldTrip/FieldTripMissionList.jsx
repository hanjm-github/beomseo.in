import { Clock3, ExternalLink, Paperclip, UserRound } from 'lucide-react';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';
import {
  buildMissionPreview,
  formatFieldTripDate,
  getFirstFieldTripImage,
} from '../../features/fieldTrip/utils';

export default function FieldTripMissionList({
  classSummary,
  posts,
  loading,
  onSelectPost,
}) {
  return (
    <section className={`${styles.sectionCard} ${styles.listPanel}`}>
      <div className={styles.listHeader}>
        <div>
          <p className={styles.sectionEyebrow}>게시글 목록</p>
          <h2 className={styles.sectionTitle}>{classSummary.label} 게시글</h2>
          <p className={styles.sectionDescription}>
            썸네일이 있는 글은 사진과 함께 보이고, 게시글을 누르면 새 탭에서 상세 내용을 엽니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.inlineState}>게시글을 불러오는 중입니다.</div>
      ) : posts.length ? (
        <div className={styles.postList}>
          {posts.map((post) => {
            const leadImage = getFirstFieldTripImage(post);

            return (
              <button
                key={post.id}
                type="button"
                className={styles.postCard}
                onClick={() => onSelectPost?.(post.id)}
              >
                {leadImage ? (
                  <div className={styles.postCardMedia}>
                    <img
                      src={leadImage.url}
                      alt={`${post.title} 대표 사진`}
                      className={styles.postCardThumb}
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className={styles.postCardBody}>
                  <div className={styles.postCardHeader}>
                    <h3 className={styles.postTitle}>{post.title}</h3>
                    <div className={styles.postCardHeaderMeta}>
                      {post.attachments?.length ? (
                        <span className={styles.postAttachmentBadge}>
                          <Paperclip size={13} />
                          {post.attachments.length}
                        </span>
                      ) : null}
                      <span className={styles.postOpenBadge}>
                        <ExternalLink size={13} />
                        새 탭
                      </span>
                    </div>
                  </div>
                  <p className={styles.postPreview}>{buildMissionPreview(post.body)}</p>
                  <div className={styles.postMetaRow}>
                    <span className={styles.postMetaItem}>
                      <UserRound size={13} />
                      {post.nickname}
                    </span>
                    <span className={styles.postMetaItem}>
                      <Clock3 size={13} />
                      {formatFieldTripDate(post.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyCard}>
          아직 등록된 글이 없습니다. 위의 새 글 쓰기 버튼으로 첫 게시물을 남겨 보세요.
        </div>
      )}
    </section>
  );
}
