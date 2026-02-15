import styles from './subjects.module.css';

const tabs = [
  { key: 1, label: '1학년' },
  { key: 2, label: '2학년' },
  { key: 3, label: '3학년' },
];

export default function GradeTabs({ value, onChange }) {
  return (
    <div className={styles.tabRow} role="tablist" aria-label="학년 선택">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          className={`${styles.tab} ${value === tab.key ? styles.tabActive : ''}`}
          onClick={() => onChange?.(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
