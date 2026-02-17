import styles from './survey.module.css';

export default function SurveyCreditBadge({ credits }) {
  const base = credits?.base ?? 0;
  const earned = credits?.earned ?? 0;
  const used = credits?.used ?? 0;
  const available = credits?.available ?? base + earned - used;

  return (
    <div className={styles.badgeRow}>
      <span className={styles.chip}>기본 {base}</span>
      <span className={styles.chip}>획득 {earned}</span>
      <span className={styles.chip}>사용 {used}</span>
      <span className={`${styles.chip} ${styles.chipActive}`}>잔여 {available}</span>
      <span className={styles.chip} style={{ background: '#ecfeff', color: '#0ea5e9', borderColor: '#bae6fd' }}>
        응답하면 +5
      </span>
    </div>
  );
}
