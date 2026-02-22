/**
 * @file src/components/clubRecruit/InfiniteLoader.jsx
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
 * InfiniteLoader module entry point.
 */
export default function InfiniteLoader({ message = '불러오는 중...' }) {
  return (
    <div className={styles.loader}>
      <div className={styles.spinner} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}


