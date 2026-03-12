import { ArrowRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';

import styles from './AcademicUpcomingCard.module.css';

export default function AcademicUpcomingCard({ event, href = '/school-info/calendar' }) {
  if (!event) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>다음 학사 일정</span>
          <CalendarDays size={18} className={styles.icon} />
        </div>
        <h3 className={styles.title}>예정된 일정이 없습니다.</h3>
        <p className={styles.description}>전체 학사 캘린더에서 연간 일정을 확인할 수 있습니다.</p>
        <Link className={styles.link} to={href}>
          전체 캘린더 보기
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>다음 학사 일정</span>
        <CalendarDays size={18} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{event.title}</h3>
      <Link className={styles.link} to={href}>
        학사 캘린더에서 보기
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
