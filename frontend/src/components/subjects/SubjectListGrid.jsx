import styles from "./subjects.module.css";

export default function SubjectListGrid({ children }) {
  return <div className={styles.grid}>{children}</div>;
}
