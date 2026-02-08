import { useState } from 'react';
import { Utensils, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './MealCard.module.css';

// Mock meal data - will be replaced with API call
const mockMeals = {
    lunch: ['쇠고기미역국', '돼지고기김치볶음', '계란찜', '깍두기', '흰쌀밥'],
    dinner: ['된장찌개', '제육볶음', '무생채', '배추김치', '잡곡밥'],
};

export default function MealCard({ date = new Date() }) {
    const [mealType, setMealType] = useState('lunch');
    const [liked, setLiked] = useState(null);

    const meals = mockMeals[mealType];

    const formatDate = (d) => {
        return d.toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
    };

    const handleLike = () => {
        setLiked(liked === 'like' ? null : 'like');
    };

    const handleDislike = () => {
        setLiked(liked === 'dislike' ? null : 'dislike');
    };

    return (
        <div className={styles.card}>
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <Utensils size={20} className={styles.icon} />
                    <h3 className={styles.title}>오늘의 급식</h3>
                </div>
                <span className={styles.date}>{formatDate(date)}</span>
            </div>

            {/* Meal Type Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${mealType === 'lunch' ? styles.active : ''}`}
                    onClick={() => setMealType('lunch')}
                >
                    점심
                </button>
                <button
                    className={`${styles.tab} ${mealType === 'dinner' ? styles.active : ''}`}
                    onClick={() => setMealType('dinner')}
                >
                    저녁
                </button>
            </div>

            {/* Menu List */}
            <ul className={styles.menuList}>
                {meals.map((item, index) => (
                    <li key={index} className={styles.menuItem}>
                        <span className={styles.bullet}>•</span>
                        {item}
                    </li>
                ))}
            </ul>

            {/* Actions */}
            <div className={styles.actions}>
                <span className={styles.rateLabel}>급식 평가:</span>
                <button
                    className={`${styles.rateButton} ${liked === 'like' ? styles.liked : ''}`}
                    onClick={handleLike}
                    aria-label="좋아요"
                >
                    <ThumbsUp size={16} />
                    <span>맛있어요</span>
                </button>
                <button
                    className={`${styles.rateButton} ${liked === 'dislike' ? styles.disliked : ''}`}
                    onClick={handleDislike}
                    aria-label="싫어요"
                >
                    <ThumbsDown size={16} />
                    <span>아쉬워요</span>
                </button>
            </div>
        </div>
    );
}
