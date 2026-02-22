/**
 * @file src/components/survey/SurveyCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ../RoleName/RoleName
 * - ./survey.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Calendar, PieChart, User } from 'lucide-react';
import RoleName from '../RoleName/RoleName';
import styles from './survey.module.css';

/**
 * SurveyCard module entry point.
 */
export default function SurveyCard({ survey, onOpen, onResults, isAdmin }) {
  const remaining = Math.max(0, (survey.responseQuota || 0) - (survey.responsesReceived || 0));
  const progress = Math.min(
    100,
    ((survey.responsesReceived || 0) / Math.max(1, survey.responseQuota || 1)) * 100
  );

  return (
    <div
      className={styles.card}
      onClick={() => onOpen?.(survey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' ? onOpen?.(survey) : null)}
    >
      <div className={styles.cardHeader}>
        <div className={styles.badgeRow} style={{ gap: 6 }}>
          {isAdmin && survey.approvalStatus ? (
            <span className={`${styles.chip} ${survey.approvalStatus === 'approved' ? styles.chipActive : ''}`}>
              {survey.approvalStatus === 'approved' ? '승인됨' : '승인대기'}
            </span>
          ) : null}
        </div>
        {onResults ? (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResults(survey);
            }}
          >
            결과
          </button>
        ) : null}
      </div>

      <h3 className={styles.cardTitle}>{survey.title}</h3>
      <p className={styles.cardDesc}>{survey.summary || survey.description}</p>

      <div className={styles.progressWrap} aria-label="응답 진행률">
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.metaRow} style={{ marginTop: 8 }}>
        <span>응답 {survey.responsesReceived ?? 0} / {survey.responseQuota ?? 0}</span>
        <span>잔여 {remaining}</span>
      </div>

      <div className={styles.metaRow} style={{ marginTop: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <User size={14} />
          <RoleName nickname={survey.owner?.name || '작성자'} role={survey.owner?.role || 'student'} size="sm" />
        </span>
        {survey.expiresAt ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} />
            {new Date(survey.expiresAt).toLocaleDateString()}
          </span>
        ) : null}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <PieChart size={14} />
          {survey.status === 'closed' ? '마감' : '진행 중'}
        </span>
      </div>
    </div>
  );
}


