/**
 * @file src/components/clubRecruit/GradeTabs.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./clubRecruit.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import styles from './clubRecruit.module.css';

const tabs = [
  { key: 'lower', label: '1·2학년' },
  { key: 'upper', label: '3학년' },
];

/**
 * GradeTabs module entry point.
 */
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


