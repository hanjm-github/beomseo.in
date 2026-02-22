import { Utensils } from 'lucide-react';
import styles from './MealCard.module.css';

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
