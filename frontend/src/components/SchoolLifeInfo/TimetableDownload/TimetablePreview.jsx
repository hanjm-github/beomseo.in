import { forwardRef } from 'react';
import TimetableSvg from './TimetableSvg';
import styles from './timetable.module.css';

const TimetablePreview = forwardRef(function TimetablePreview(
  { template, draftValues, grade, fontReady },
  ref
) {
  return (
    <section className={styles.previewCard} aria-label="시간표 미리보기">
      <div className={styles.previewHeader}>
        <div>
          <h2>미리보기</h2>
          <p>아래 보이는 시간표 그대로 PNG 파일이 저장됩니다.</p>
        </div>
      </div>

      <div className={styles.previewViewport}>
        {template ? (
          <div className={styles.previewPaper}>
            <TimetableSvg
              key={`${template.classId}-${fontReady ? 'font-ready' : 'font-pending'}`}
              ref={ref}
              template={template}
              draftValues={draftValues}
              grade={grade}
            />
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>학년과 반을 선택하면 시간표 미리보기가 여기서 바로 갱신됩니다.</p>
          </div>
        )}
      </div>
    </section>
  );
});

export default TimetablePreview;
