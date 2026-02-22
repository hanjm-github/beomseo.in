/**
 * @file src/components/MealCard/MealCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./MealCard.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Utensils } from 'lucide-react';
import styles from './MealCard.module.css';

/**
 * MealCard module entry point.
 */
export default function MealCard() {
    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <Utensils size={20} className={styles.icon} />
                    <h3 className={styles.title}>오늘의 급식</h3>
                </div>
            </div>

            <p className={styles.comingSoon}>현재 열심히 준비중</p>
        </div>
    );
}


