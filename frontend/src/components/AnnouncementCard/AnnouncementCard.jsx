import { Link } from 'react-router-dom';
import { Pin, Calendar } from 'lucide-react';
import styles from './AnnouncementCard.module.css';

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
