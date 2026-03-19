import { ChevronRight, LayoutGrid, LockKeyhole, LockOpen } from 'lucide-react';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

function LoadingCard({ index }) {
  return (
    <div key={`field-trip-loading-${index}`} className={`${styles.classCard} ${styles.classCardMuted}`}>
      <div className={styles.classCardTop}>
        <span className={styles.classStatus}>불러오는 중…</span>
      </div>
      <div className={styles.classTitleRow}>
        <span className={styles.classTitle}>반 정보 확인 중</span>
      </div>
    </div>
  );
}

export default function FieldTripClassGrid({
  classes,
  selectedClassId,
  loading,
  onSelectClass,
}) {
  return (
    <section className={`${styles.sectionCard} ${styles.classGridSection}`}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionEyebrow}>미션 수행</p>
          <h2 className={styles.sectionTitle}>반별 미션 게시판 입장</h2>
          <p className={styles.sectionDescription}>
            각 반 게시판에 들어가 사진이 포함된 현장 기록 목록과 새 탭 상세 페이지를 확인할 수
            있습니다.
          </p>
        </div>
        <span className={styles.sectionPill}>
          <LayoutGrid size={14} />
          총 {classes.length || 10}개 반
        </span>
      </div>

      <div className={styles.classGrid}>
        {loading && !classes.length
          ? Array.from({ length: 10 }, (_, index) => <LoadingCard index={index} key={index} />)
          : classes.map((classItem) => {
              const isSelected = selectedClassId === classItem.classId;
              const isUnlocked = classItem.isUnlocked;

              return (
                <button
                  key={classItem.classId}
                  type="button"
                  className={`${styles.classCard} ${
                    isSelected ? styles.classCardSelected : ''
                  } ${isUnlocked ? styles.classCardUnlocked : styles.classCardLocked}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectClass?.(classItem.classId)}
                >
                  <div className={styles.classCardTop}>
                    <span className={styles.classStatus}>
                      {isUnlocked ? <LockOpen size={14} /> : <LockKeyhole size={14} />}
                      {isUnlocked ? '입장 가능' : '비밀번호 필요'}
                    </span>
                    <ChevronRight size={16} className={styles.classArrow} />
                  </div>
                  <div className={styles.classTitleRow}>
                    <h3 className={styles.classTitle}>{classItem.label}</h3>
                    <span className={styles.classMetaInline}>
                      누적게시글 {classItem.postCount}개
                    </span>
                  </div>
                </button>
              );
            })}
      </div>
    </section>
  );
}
