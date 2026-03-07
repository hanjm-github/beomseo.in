import { AlertCircle, CheckCircle2, Download, GraduationCap, PenLine } from 'lucide-react';
import {
  GRADE_OPTIONS,
  RECOMMENDED_ROOM_LENGTH,
  RECOMMENDED_SUBJECT_LENGTH,
  formatMissingFieldLabel,
  getDraftEntry,
} from './timetableUtils';
import styles from './timetable.module.css';

function tokenLabel(token) {
  return token === '음/미' ? '음/미 선택' : `${token} 선택과목`;
}

function hasFieldIssue(list, token, field) {
  return list.some((item) => item.token === token && item.field === field);
}

export default function TimetableControls({
  selectedGrade,
  selectedClass,
  classOptions,
  activeTemplate,
  requiredTokens,
  draftValues,
  tokenSwatches,
  validation,
  isDownloading,
  downloadError,
  onGradeChange,
  onClassChange,
  onDraftChange,
  onDownload,
}) {
  const isDownloadDisabled = !validation.canDownload || isDownloading || !activeTemplate;

  return (
    <section className={styles.controlsCard} aria-label="시간표 설정">
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>시간표 선택</h2>
            <p>학년과 반을 고르면 해당 양식 또는 편집 템플릿이 열립니다.</p>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusPill}>
              <GraduationCap size={16} />
              학교 생활 정보
            </span>
          </div>
        </div>

        <div className={styles.selectGrid}>
          <div className={styles.field}>
            <label htmlFor="timetable-grade">학년</label>
            <select id="timetable-grade" value={selectedGrade} onChange={onGradeChange}>
              <option value="">학년 선택</option>
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="timetable-class">반</label>
            <select
              id="timetable-class"
              value={selectedClass}
              onChange={onClassChange}
              disabled={!selectedGrade}
            >
              <option value="">{selectedGrade ? '반 선택' : '학년을 먼저 선택하세요'}</option>
              {classOptions.map((option) => (
                <option key={option.classId} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeTemplate ? (
          <p className={styles.selectionHint}>
            현재 선택: <strong>{activeTemplate.classId}</strong> 시간표
          </p>
        ) : (
          <p className={styles.selectionHint}>먼저 학년과 반을 선택해 시간표를 불러오세요.</p>
        )}
      </div>

      {activeTemplate && requiredTokens.length > 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>선택과목 입력</h3>
              <p>과목명과 교실을 모두 채워야 다운로드 버튼이 활성화됩니다.</p>
            </div>
            <div className={styles.statusRow}>
              <span
                className={`${styles.statusPill} ${
                  validation.canDownload ? styles.statusReady : styles.statusBlocked
                }`}
              >
                {validation.canDownload ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {validation.canDownload ? '다운로드 가능' : '입력 필요'}
              </span>
            </div>
          </div>

          <div className={styles.tokenSummary}>
            {requiredTokens.map((token) => (
              <span key={token} className={styles.tokenChip}>
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: tokenSwatches[token] || '#ffffff' }}
                  aria-hidden="true"
                />
                {token}
              </span>
            ))}
          </div>

          <div className={styles.fieldGrid}>
            {requiredTokens.map((token) => {
              const draftEntry = getDraftEntry(draftValues, token);
              const subjectOverflow = hasFieldIssue(validation.overflowFields, token, 'subject');
              const roomOverflow = hasFieldIssue(validation.overflowFields, token, 'room');

              return (
                <div key={token} className={styles.field}>
                  <label htmlFor={`timetable-token-${token}`}>
                    <span className={styles.labelRow}>
                      <span
                        className={styles.swatch}
                        style={{ backgroundColor: tokenSwatches[token] || '#ffffff' }}
                        aria-hidden="true"
                      />
                      {tokenLabel(token)}
                    </span>
                  </label>

                  <div className={styles.subFieldStack}>
                    <div className={styles.subField}>
                      <span className={styles.subFieldLabel}>과목명</span>
                      {token === '음/미' ? (
                        <select
                          id={`timetable-token-${token}`}
                          value={draftEntry.subject}
                          onChange={(event) => onDraftChange(token, 'subject', event.target.value)}
                        >
                          <option value="">음악 / 미술 선택</option>
                          <option value="음악">음악</option>
                          <option value="미술">미술</option>
                        </select>
                      ) : (
                        <input
                          id={`timetable-token-${token}`}
                          type="text"
                          value={draftEntry.subject}
                          onChange={(event) => onDraftChange(token, 'subject', event.target.value)}
                          placeholder="예: 일본어"
                          maxLength={12}
                        />
                      )}
                      <p className={styles.fieldHint}>권장 길이 {RECOMMENDED_SUBJECT_LENGTH}자 이내</p>
                      {subjectOverflow ? (
                        <p className={styles.errorText}>과목명이 셀 너비를 초과했습니다.</p>
                      ) : null}
                    </div>

                    <div className={styles.subField}>
                      <span className={styles.subFieldLabel}>교실</span>
                      <input
                        id={`timetable-room-${token}`}
                        type="text"
                        value={draftEntry.room}
                        onChange={(event) => onDraftChange(token, 'room', event.target.value)}
                        placeholder="예: 영어3실"
                        maxLength={18}
                      />
                      <p className={styles.fieldHint}>권장 길이 {RECOMMENDED_ROOM_LENGTH}자 이내</p>
                      {roomOverflow ? (
                        <p className={styles.errorText}>교실명이 셀 너비를 초과했습니다.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTemplate && requiredTokens.length === 0 ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>1학년 공통 시간표</h3>
              <p>1학년은 반별 고정 시간표라 추가 입력 없이 바로 저장할 수 있습니다.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.section}>
        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-primary ${styles.actionButton}`}
            onClick={onDownload}
            disabled={isDownloadDisabled}
          >
            {isDownloading ? <PenLine size={18} /> : <Download size={18} />}
            <span>{isDownloading ? '이미지 생성 중...' : 'PNG로 다운로드'}</span>
          </button>
        </div>

        {downloadError ? <p className={styles.errorText}>{downloadError}</p> : null}
        {!validation.canDownload && activeTemplate ? (
          <p className={styles.helperText}>
            {validation.missingFields.length > 0
              ? `필수 입력: ${validation.missingFields
                  .slice(0, 4)
                  .map(({ token, field }) => formatMissingFieldLabel(token, field))
                  .join(', ')}${validation.missingFields.length > 4 ? ' 외' : ''}`
              : '입력값 길이를 줄이면 다운로드가 활성화됩니다.'}
          </p>
        ) : null}
      </div>
    </section>
  );
}
