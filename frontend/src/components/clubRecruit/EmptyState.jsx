/**
 * @file src/components/clubRecruit/EmptyState.jsx
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
 * EmptyState module entry point.
 */
export default function EmptyState({ message = '모집 중인 동아리가 없어요.' }) {
  return <div className={styles.empty}>{message}</div>;
}


