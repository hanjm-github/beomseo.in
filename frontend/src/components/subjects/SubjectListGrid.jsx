/**
 * @file src/components/subjects/SubjectListGrid.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - ./subjects.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import styles from "./subjects.module.css";

/**
 * SubjectListGrid module entry point.
 */
export default function SubjectListGrid({ children }) {
  return <div className={styles.grid}>{children}</div>;
}


