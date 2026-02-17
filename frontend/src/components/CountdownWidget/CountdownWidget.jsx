import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import styles from './CountdownWidget.module.css';

export default function CountdownWidget({
    targetDate,
    eventName = '다가오는 일정',
    showDetails = true
}) {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(targetDate));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft(targetDate));
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    function calculateTimeLeft(date) {
        const now = new Date();
        const target = new Date(date);
        const difference = target - now;

        if (difference <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true };
        }

        return {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / (1000 * 60)) % 60),
            seconds: Math.floor((difference / 1000) % 60),
            isOver: false,
        };
    }

    const urgencyLevel = useMemo(() => {
        if (timeLeft.days <= 3) return 'urgent';
        if (timeLeft.days <= 7) return 'warning';
        return 'normal';
    }, [timeLeft.days]);

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
        });
    };

    if (timeLeft.isOver) {
        return (
            <div className={`${styles.widget} ${styles.over}`}>
                <div className={styles.header}>
                    <AlertCircle size={18} />
                    <span>{eventName}</span>
                </div>
                <div className={styles.overMessage}>
                    해당 일정이 종료되었습니다.
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.widget} ${styles[urgencyLevel]}`}>
            <div className={styles.header}>
                <Calendar size={18} />
                <span>{eventName}</span>
                {urgencyLevel === 'urgent' && (
                    <span className={styles.urgentBadge}>D-{timeLeft.days}</span>
                )}
            </div>

            <div className={styles.countdown}>
                <div className={styles.timeUnit}>
                    <span className={styles.number}>{String(timeLeft.days).padStart(2, '0')}</span>
                    <span className={styles.label}>일</span>
                </div>
                <span className={styles.separator}>:</span>
                <div className={styles.timeUnit}>
                    <span className={styles.number}>{String(timeLeft.hours).padStart(2, '0')}</span>
                    <span className={styles.label}>시</span>
                </div>
                <span className={styles.separator}>:</span>
                <div className={styles.timeUnit}>
                    <span className={styles.number}>{String(timeLeft.minutes).padStart(2, '0')}</span>
                    <span className={styles.label}>분</span>
                </div>
                <span className={styles.separator}>:</span>
                <div className={styles.timeUnit}>
                    <span className={styles.number}>{String(timeLeft.seconds).padStart(2, '0')}</span>
                    <span className={styles.label}>초</span>
                </div>
            </div>

            {showDetails && (
                <div className={styles.details}>
                    <Clock size={14} />
                    <span>{formatDate(targetDate)} 예정</span>
                </div>
            )}
        </div>
    );
}
