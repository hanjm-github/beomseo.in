/**
 * @file src/components/clubRecruit/RecruitGrid.jsx
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

/**
 * RecruitGrid module entry point.
 */
export default function RecruitGrid({ children }) {
  return <div className={styles.grid}>{children}</div>;
}


