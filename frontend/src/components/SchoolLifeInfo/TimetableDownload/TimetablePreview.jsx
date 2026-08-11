import { forwardRef } from 'react';
import TimetableSvg from './TimetableSvg';
import styles from './timetable.module.css';

const TimetablePreview = forwardRef(function TimetablePreview(
  {
    template,
    draftValues,
    grade,
    fontReady,
    backgroundUrl,
    bgOpacity,
    onCatToggle,
    colorTheme,
    onColorThemeChange,
  },
  ref
) {
  return (
    <section className={styles.previewCard} aria-label="시간표 미리보기">
      <div className={styles.previewHeader}>
        <div>
          <h2>미리보기</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(128, 128, 128, 0.12)',
              padding: '3px',
              borderRadius: '10px',
              gap: '2px',
              border: '1px solid rgba(128, 128, 128, 0.2)',
            }}
          >
            <button
              type="button"
              onClick={() => onColorThemeChange?.('light')}
              style={{
                background: colorTheme === 'light' ? '#ffffff' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                boxShadow: colorTheme === 'light' ? '0 1px 3px rgba(0, 0, 0, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="화이트 모드 (☀️)"
            >
              ☀️
            </button>
            <button
              type="button"
              onClick={() => onColorThemeChange?.('dark')}
              style={{
                background: colorTheme === 'dark' ? '#1e293b' : 'transparent',
                border: 'none',
                borderRadius: '7px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: 1,
                boxShadow: colorTheme === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="다크 모드 (🌙)"
            >
              🌙
            </button>
          </div>

          <button
            type="button"
            onClick={onCatToggle}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px',
              transition: 'background 0.2s',
            }}
            title="고양이 배경 모드"
          >
            🐱
          </button>
        </div>
      </div>

      <div className={styles.previewViewport}>
        {template ? (
          <div className={styles.previewPaper}>
            <TimetableSvg
              key={`${template.classId}-${fontReady ? 'font-ready' : 'font-pending'}-${colorTheme}`}
              ref={ref}
              template={template}
              draftValues={draftValues}
              grade={grade}
              backgroundUrl={backgroundUrl}
              bgOpacity={bgOpacity}
              colorTheme={colorTheme}
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

