import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Soup } from 'lucide-react';
import { Link } from 'react-router-dom';

import { mealsApi } from '../../api/meals';
import {
  formatDateKey,
  formatMonthKey,
  formatRailDate,
  formatWeekday,
  getReferenceDate,
} from '../../features/meals/utils';
import styles from './MealCard.module.css';

function buildPlaceholderMeal(referenceDate, overrides = {}) {
  return {
    id: `meal-${formatDateKey(referenceDate)}`,
    date: formatDateKey(referenceDate),
    status: 'empty',
    service: 'lunch',
    serviceLabel: '중식',
    menuItems: [],
    previewText: '급식 정보를 불러오는 중입니다.',
    note: '잠시만 기다려 주세요.',
    isNoMeal: true,
    ratings: {
      taste: {
        averageScore: null,
        totalCount: 0,
        myScore: null,
        distribution: [],
      },
      anticipation: {
        averageScore: null,
        totalCount: 0,
        myScore: null,
        distribution: [],
      },
    },
    ...overrides,
  };
}

export default function MealCard() {
  const referenceDate = useMemo(() => getReferenceDate(), []);
  const [todayMeal, setTodayMeal] = useState(() => buildPlaceholderMeal(referenceDate));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadTodayMeal() {
      try {
        const meal = await mealsApi.getToday();
        if (!isActive) return;
        setTodayMeal(meal);
        setLoadError('');
      } catch (error) {
        if (!isActive) return;
        setTodayMeal(
          buildPlaceholderMeal(referenceDate, {
            previewText: '오늘 급식 정보를 불러오지 못했어요.',
            note: '잠시 후 다시 시도해 주세요.',
          })
        );
        setLoadError(error instanceof Error ? error.message : '오늘 급식 정보를 불러오지 못했어요.');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadTodayMeal();

    return () => {
      isActive = false;
    };
  }, [referenceDate]);

  const mealUrl = `/school-info/meal?tab=today&date=${
    todayMeal?.date || formatDateKey(referenceDate)
  }&month=${formatMonthKey(referenceDate)}`;
  const noteText = loadError || todayMeal?.note;
  const emptyText = isLoading
    ? '급식 정보를 불러오는 중입니다.'
    : loadError || '주말에는 점심 급식을 운영하지 않아요.';

  return (
    <Link to={mealUrl} className={styles.card} aria-label="오늘의 급식 자세히 보기">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.iconShell}>
            <Soup size={18} className={styles.icon} />
          </div>
          <div className={styles.titleCopy}>
            <p className={styles.eyebrow}>학교 급식</p>
            <h3 className={styles.title}>오늘의 점심</h3>
          </div>
        </div>
        <span className={`${styles.badge} ${todayMeal?.isNoMeal ? styles.badgeMuted : styles.badgeLive}`}>
          {todayMeal?.isNoMeal ? '운영 없음' : '전체 메뉴'}
        </span>
      </div>

      <div className={styles.dateRow}>
        <strong className={styles.dateNumber}>{formatRailDate(referenceDate)}</strong>
        <span className={styles.dateText}>{formatWeekday(referenceDate)}요일 메뉴</span>
      </div>

      {todayMeal?.menuItems?.length ? (
        <ul className={styles.menuList}>
          {todayMeal.menuItems.map((item) => (
            <li key={item} className={styles.menuItem}>
              <span className={styles.menuBullet} />
              <span className={styles.menuItemText}>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.emptyState}>{emptyText}</div>
      )}

      <div className={styles.footer}>
        <span className={styles.note}>{noteText}</span>
        <span className={styles.linkHint}>
          <CalendarDays size={14} />
          이달의 급식 보기
        </span>
      </div>
    </Link>
  );
}
