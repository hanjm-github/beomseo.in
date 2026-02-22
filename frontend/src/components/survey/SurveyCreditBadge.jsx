/**
 * @file src/components/survey/SurveyCreditBadge.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./survey.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import styles from './survey.module.css';

/**
 * SurveyCreditBadge module entry point.
 */
export default function SurveyCreditBadge({ credits }) {
  const earned = credits?.earned ?? 0;
  const used = credits?.used ?? 0;
  const available = credits?.available ?? earned - used;

  return (
    <div className={styles.badgeRow}>
      <span className={styles.chip}>획득 {earned}</span>
      <span className={styles.chip}>사용 {used}</span>
      <span className={`${styles.chip} ${styles.chipActive}`}>잔여 {available}</span>
      <span className={`${styles.chip} ${styles.chipInfo}`}>
        승인 시 +30
      </span>
      <span className={`${styles.chip} ${styles.chipBonus}`}>
        응답하면 +5
      </span>
    </div>
  );
}


