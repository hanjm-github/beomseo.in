import styles from './clubRecruit.module.css';

export default function RecruitGrid({ children }) {
  return <div className={styles.grid}>{children}</div>;
}
