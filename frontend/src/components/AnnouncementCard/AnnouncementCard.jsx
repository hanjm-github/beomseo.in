/**
 * @file src/components/AnnouncementCard/AnnouncementCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react-router-dom
 * - lucide-react
 * - ./AnnouncementCard.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Link } from 'react-router-dom';
import { Pin, Calendar } from 'lucide-react';
import styles from './AnnouncementCard.module.css';

/**
 * AnnouncementCard module entry point.
 */
export default function AnnouncementCard({
    id,
    title,
    date,
    category,
    isPinned = false,
    linkBase = '/notices'
}) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = now - date;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return '오늘';
        if (diffDays === 1) return '어제';
        if (diffDays < 7) return `${diffDays}일 전`;

        return date.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <Link to={`${linkBase}/${id}`} className={`${styles.card} ${isPinned ? styles.pinned : ''}`}>
            <div className={styles.content}>
                {isPinned && (
                    <span className={styles.pinnedBadge}>
                        <Pin size={12} />
                    </span>
                )}
                <h4 className={styles.title}>{title}</h4>
            </div>
            <div className={styles.meta}>
                {category && (
                    <span className={styles.category}>{category}</span>
                )}
                <span className={styles.date}>
                    <Calendar size={12} />
                    {formatDate(date)}
                </span>
            </div>
        </Link>
    );
}


