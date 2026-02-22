/**
 * @file src/components/clubRecruit/ErrorState.jsx
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
 * ErrorState module entry point.
 */
export default function ErrorState({ message = '데이터를 불러오지 못했습니다.', onRetry }) {
  return (
    <div className={styles.errorState}>
      <p>{message}</p>
      {onRetry ? (
        <button className={styles.retryBtn} type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}


