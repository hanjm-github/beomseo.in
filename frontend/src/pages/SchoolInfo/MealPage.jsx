import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Clock3,
  Download,
  Info,
  Smartphone,
  Star,
  Soup,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { mealNotificationsApi } from '../../api/mealNotifications';
import { mealsApi } from '../../api/meals';
import { usePwaInstall } from '../../context/PwaInstallContext';
import MealNotificationTimePicker from '../../features/meals/components/MealNotificationTimePicker';
import {
  addMonths,
  buildMealWeekdayMatrix,
  endOfMonth,
  formatDateKey,
  formatHeroDate,
  formatMonthKey,
  formatRailDate,
  formatWeekday,
  getDateRange,
  getMealStatusLabel,
  getMonthOptions,
  getMonthEntries,
  getNormalizedMealRouteState,
  getReferenceDate,
  getRelativeLabel,
  isSameDate,
  parseDateKey,
  startOfMonth,
} from '../../features/meals/utils';
import {
  DEFAULT_MEAL_NOTIFICATION_TIME,
  DEFAULT_MEAL_NOTIFICATION_TIMEZONE,
  normalizeMealNotificationTime,
} from '../../features/meals/notificationTime';
import {
  deleteCurrentFirebaseMessagingToken,
  getBrowserNotificationPermission,
  getCurrentFirebaseMessagingToken,
  isFirebaseMessagingConfigured,
  isFirebaseMessagingSupported,
  requestFirebaseMessagingPermissionAndToken,
} from '../../pwa/firebaseMessaging';
import { getMealNotificationInstallationId } from '../../pwa/mealNotificationInstallationId';
import '../page-shell.css';
import styles from './MealPage.module.css';

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금'];
const TABS = [
  { id: 'today', label: '오늘의 급식' },
  { id: 'month', label: '이달의 급식' },
];
const RATING_SCORES = [1, 2, 3, 4, 5];
const RATING_GROUPS = [
  {
    key: 'anticipation',
    title: '오늘 급식 기다려져요',
    description: '기대되는 정도를 1점부터 5점까지 평가해보세요.',
  },
  {
    key: 'taste',
    title: '이 급식 어때요',
    description: '맛과 구성 만족도를 1점부터 5점까지 남겨보세요.',
  },
];
const NO_MEAL_RATING_MESSAGE = '운영되지 않는 날은 평점을 남길 수 없습니다.';
const PAST_RATING_MESSAGE = '지난 급식은 더 이상 입력할 수 없어요.';
const TASTE_TODAY_ONLY_MESSAGE = '이 급식 어때요는 급식 당일에만 입력할 수 있어요.';
const ALLERGY_INFO = [
  '1. 난류(계란)',
  '2. 우유',
  '3. 메밀',
  '4. 땅콩',
  '5. 대두(콩)',
  '6. 밀',
  '7. 고등어',
  '8. 게',
  '9. 새우',
  '10. 돼지고기',
  '11. 복숭아',
  '12. 토마토',
  '13. 아황산류',
  '14. 호두',
  '15. 닭고기',
  '16. 쇠고기',
  '17. 오징어',
  '18. 조개류(굴, 전복, 홍합 포함)',
  '19. 잣',
];

function createEmptyRatingSummary() {
  return {
    averageScore: null,
    totalCount: 0,
    myScore: null,
    distribution: RATING_SCORES.map((score) => ({
      score,
      count: 0,
      ratio: 0,
    })),
  };
}

function createEmptyRatings() {
  return {
    taste: createEmptyRatingSummary(),
    anticipation: createEmptyRatingSummary(),
  };
}

function getMealMenuText(menuItems = []) {
  return Array.isArray(menuItems) && menuItems.length ? menuItems.join(' · ') : '';
}

function getRatingAvailability(category, selectedDate, referenceDate, entry) {
  if (!entry || entry.isNoMeal) {
    return {
      canRate: false,
      reason: NO_MEAL_RATING_MESSAGE,
    };
  }

  const selectedTime = selectedDate.getTime();
  const referenceTime = referenceDate.getTime();

  if (selectedTime < referenceTime) {
    return {
      canRate: false,
      reason: PAST_RATING_MESSAGE,
    };
  }

  if (category === 'taste' && !isSameDate(selectedDate, referenceDate)) {
    return {
      canRate: false,
      reason: TASTE_TODAY_ONLY_MESSAGE,
    };
  }

  return {
    canRate: true,
    reason: '',
  };
}

function buildEmptyMealEntry(date) {
  const dateKey = formatDateKey(date);

  return {
    id: `meal-${dateKey}`,
    date: dateKey,
    status: 'empty',
    service: 'lunch',
    serviceLabel: '중식',
    menuItems: [],
    previewText: '급식 정보가 없습니다.',
    note: '주말, 휴일 또는 미제공일입니다.',
    isNoMeal: true,
    calorieText: null,
    caloriesKcal: null,
    originItems: [],
    nutritionItems: [],
    ratings: createEmptyRatings(),
    syncedAt: null,
  };
}

function buildInitialMealEntriesByDate(referenceDate) {
  const previousMonth = startOfMonth(addMonths(referenceDate, -1));
  const nextMonth = endOfMonth(addMonths(referenceDate, 1));
  const entries = {};

  for (
    let cursor = previousMonth;
    cursor.getTime() <= nextMonth.getTime();
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  ) {
    const normalizedDate = getReferenceDate(cursor);
    const entry = buildEmptyMealEntry(normalizedDate);
    entries[entry.date] = entry;
  }

  return entries;
}

function normalizeMealNotificationItem(item, installationId) {
  const time = typeof item?.notificationTime === 'string' && item.notificationTime
    ? item.notificationTime
    : DEFAULT_MEAL_NOTIFICATION_TIME;

  return {
    installationId,
    enabled: Boolean(item?.enabled),
    notificationTime: normalizeMealNotificationTime(time),
    timezone:
      typeof item?.timezone === 'string' && item.timezone
        ? item.timezone
        : DEFAULT_MEAL_NOTIFICATION_TIMEZONE,
    hasToken: Boolean(item?.hasToken),
    lastSentMealDate:
      typeof item?.lastSentMealDate === 'string' && item.lastSentMealDate
        ? item.lastSentMealDate
        : null,
    updatedAt: typeof item?.updatedAt === 'string' && item.updatedAt ? item.updatedAt : null,
  };
}

export default function MealPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isInstalled, isIosManualInstall, promptInstall } = usePwaInstall();
  const referenceDate = useMemo(() => getReferenceDate(), []);
  const mealNotificationInstallationId = useMemo(
    () => getMealNotificationInstallationId(),
    [],
  );
  const isMealNotificationConfigured = isFirebaseMessagingConfigured();
  const monthOptions = useMemo(() => getMonthOptions(referenceDate), [referenceDate]);
  const initialMealEntriesByDate = useMemo(
    () => buildInitialMealEntriesByDate(referenceDate),
    [referenceDate]
  );
  const [mealEntriesByDate, setMealEntriesByDate] = useState(initialMealEntriesByDate);
  const [isMealsLoading, setIsMealsLoading] = useState(true);
  const [mealLoadError, setMealLoadError] = useState('');
  const [ratingError, setRatingError] = useState('');
  const [submittingRatingKey, setSubmittingRatingKey] = useState('');
  const visibleMonthKeys = useMemo(
    () => new Set(monthOptions.map((option) => option.key)),
    [monthOptions],
  );
  const routeState = useMemo(
    () =>
      getNormalizedMealRouteState(searchParams, referenceDate, monthOptions, mealEntriesByDate),
    [mealEntriesByDate, monthOptions, referenceDate, searchParams],
  );
  const todayDateKey = useMemo(() => formatDateKey(referenceDate), [referenceDate]);
  const selectedDate = useMemo(
    () => parseDateKey(routeState.dateKey) || referenceDate,
    [referenceDate, routeState.dateKey],
  );
  const selectedEntry = mealEntriesByDate[routeState.dateKey];
  const todayRailEntries = useMemo(
    () =>
      getDateRange(referenceDate, -7, 7).map((date) => {
        const dateKey = formatDateKey(date);

        return {
          date,
          dateKey,
          entry: mealEntriesByDate[dateKey],
        };
      }).filter(({ date, entry }) => entry && (!entry.isNoMeal || isSameDate(date, referenceDate))),
    [mealEntriesByDate, referenceDate],
  );
  const calendarWeeks = useMemo(
    () => buildMealWeekdayMatrix(routeState.monthKey, mealEntriesByDate, referenceDate),
    [mealEntriesByDate, referenceDate, routeState.monthKey],
  );
  const referenceMonthKey = useMemo(() => formatMonthKey(referenceDate), [referenceDate]);
  const selectedStatusLabel = selectedEntry
    ? getMealStatusLabel(selectedEntry, referenceDate)
    : '급식 없음';
  const selectedMenuItems = selectedEntry?.menuItems || [];
  const selectedMenuText = selectedMenuItems.length
    ? getMealMenuText(selectedMenuItems)
    : selectedEntry?.note || selectedEntry?.previewText || '선택한 날짜의 급식 정보를 불러오지 못했어요.';
  const serviceLabel = selectedEntry?.isNoMeal ? '운영 없음' : selectedEntry?.serviceLabel || '점심 1식';
  const selectedRatings = selectedEntry?.ratings || createEmptyRatings();
  const selectedCalorieText = selectedEntry?.calorieText
    || (selectedEntry?.caloriesKcal !== null && selectedEntry?.caloriesKcal !== undefined
      ? `${selectedEntry.caloriesKcal} kcal`
      : '');
  const selectedNutritionItems = selectedEntry?.nutritionItems || [];
  const ratingAvailabilityByKey = useMemo(
    () => Object.fromEntries(
      RATING_GROUPS.map((group) => [
        group.key,
        getRatingAvailability(group.key, selectedDate, referenceDate, selectedEntry),
      ]),
    ),
    [referenceDate, selectedDate, selectedEntry],
  );
  const [mealNotificationSupported, setMealNotificationSupported] = useState(null);
  const [isMealNotificationLoading, setIsMealNotificationLoading] = useState(false);
  const [isMealNotificationSaving, setIsMealNotificationSaving] = useState(false);
  const [mealNotificationError, setMealNotificationError] = useState('');
  const [mealNotificationNotice, setMealNotificationNotice] = useState('');
  const [mealNotificationPermission, setMealNotificationPermission] = useState(() =>
    getBrowserNotificationPermission(),
  );
  const [mealNotificationSubscription, setMealNotificationSubscription] = useState(() =>
    normalizeMealNotificationItem(null, mealNotificationInstallationId),
  );
  const todayRailScrollerRef = useRef(null);
  const todayRailTodayRef = useRef(null);
  const pendingTodayRailScrollRef = useRef(routeState.tab === 'today');

  useEffect(() => {
    setMealEntriesByDate(initialMealEntriesByDate);
  }, [initialMealEntriesByDate]);

  useEffect(() => {
    let isActive = true;
    const previousMonth = startOfMonth(addMonths(referenceDate, -1));
    const nextMonth = endOfMonth(addMonths(referenceDate, 1));

    async function loadMeals() {
      try {
        const items = await mealsApi.listRange(
          formatDateKey(previousMonth),
          formatDateKey(nextMonth),
        );

        if (!isActive) {
          return;
        }

        setMealEntriesByDate(Object.fromEntries(items.map((entry) => [entry.date, entry])));
        setMealLoadError('');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMealEntriesByDate(initialMealEntriesByDate);
        setMealLoadError(error instanceof Error ? error.message : '급식 정보를 불러오지 못했어요.');
      } finally {
        if (isActive) {
          setIsMealsLoading(false);
        }
      }
    }

    setIsMealsLoading(true);
    loadMeals();

    return () => {
      isActive = false;
    };
  }, [initialMealEntriesByDate, referenceDate]);

  useEffect(() => {
    let isActive = true;

    async function loadMealNotificationState() {
      setMealNotificationPermission(getBrowserNotificationPermission());
      setMealNotificationError('');
      setMealNotificationNotice('');

      if (!isInstalled) {
        setMealNotificationSupported(null);
        setMealNotificationSubscription(
          normalizeMealNotificationItem(null, mealNotificationInstallationId),
        );
        setIsMealNotificationLoading(false);
        return;
      }

      if (!isMealNotificationConfigured) {
        setMealNotificationSupported(false);
        setMealNotificationSubscription(
          normalizeMealNotificationItem(null, mealNotificationInstallationId),
        );
        setIsMealNotificationLoading(false);
        return;
      }

      setIsMealNotificationLoading(true);

      try {
        const supported = await isFirebaseMessagingSupported();
        if (!isActive) {
          return;
        }

        setMealNotificationSupported(supported);
        if (!supported) {
          setMealNotificationSubscription(
            normalizeMealNotificationItem(null, mealNotificationInstallationId),
          );
          return;
        }

        const item = await mealNotificationsApi.getSubscription(mealNotificationInstallationId);
        if (!isActive) {
          return;
        }

        setMealNotificationSubscription(
          normalizeMealNotificationItem(item, mealNotificationInstallationId),
        );

        if (getBrowserNotificationPermission() === 'granted') {
          const currentToken = await getCurrentFirebaseMessagingToken().catch(() => '');
          if (isActive && currentToken) {
            setMealNotificationSubscription((previous) => ({
              ...previous,
              hasToken: true,
            }));
          }
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMealNotificationError(
          error instanceof Error ? error.message : '급식 알림 설정을 준비하지 못했어요.'
        );
        setMealNotificationSupported(false);
      } finally {
        if (isActive) {
          setMealNotificationPermission(getBrowserNotificationPermission());
          setIsMealNotificationLoading(false);
        }
      }
    }

    loadMealNotificationState();

    return () => {
      isActive = false;
    };
  }, [isInstalled, isMealNotificationConfigured, mealNotificationInstallationId]);

  useEffect(() => {
    if (!routeState.shouldNormalize) {
      return;
    }

    startTransition(() => {
      setSearchParams(routeState.normalizedParams, { replace: true });
    });
  }, [routeState.normalizedParams, routeState.shouldNormalize, setSearchParams]);

  useEffect(() => {
    setRatingError('');
    setSubmittingRatingKey('');
  }, [routeState.dateKey]);

  useEffect(() => {
    if (routeState.tab !== 'today' || !pendingTodayRailScrollRef.current) {
      return;
    }

    const scroller = todayRailScrollerRef.current;
    const target = todayRailTodayRef.current;

    if (!scroller || !target) {
      return;
    }

    pendingTodayRailScrollRef.current = false;

    const prefersReducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    requestAnimationFrame(() => {
      const left = target.offsetLeft - ((scroller.clientWidth - target.clientWidth) / 2);
      scroller.scrollTo({
        left: Math.max(0, left),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    });
  }, [routeState.tab, todayRailEntries.length]);

  const handleMealNotificationTimeChange = (nextValue) => {
    const normalizedTime = normalizeMealNotificationTime(nextValue);
    setMealNotificationSubscription((previous) => ({
      ...previous,
      notificationTime: normalizedTime,
    }));
    setMealNotificationNotice('');
    setMealNotificationError('');
  };

  const persistMealNotificationSubscription = async ({
    enabled,
    noticeMessage,
    tokenOverride,
  }) => {
    setIsMealNotificationSaving(true);
    setMealNotificationError('');
    setMealNotificationNotice('');
    const normalizedNotificationTime = normalizeMealNotificationTime(
      mealNotificationSubscription.notificationTime,
    );

    try {
      const savedItem = await mealNotificationsApi.saveSubscription({
        installationId: mealNotificationInstallationId,
        enabled,
        notificationTime: normalizedNotificationTime,
        timezone: mealNotificationSubscription.timezone,
        fcmToken: enabled ? tokenOverride : undefined,
      });

      setMealNotificationSubscription(
        normalizeMealNotificationItem(savedItem, mealNotificationInstallationId),
      );
      setMealNotificationPermission(getBrowserNotificationPermission());
      setMealNotificationNotice(noticeMessage);
    } catch (error) {
      setMealNotificationError(
        error instanceof Error ? error.message : '급식 알림 설정을 저장하지 못했어요.'
      );
      throw error;
    } finally {
      setIsMealNotificationSaving(false);
    }
  };

  const resolveMealNotificationToken = async () => {
    if (getBrowserNotificationPermission() === 'granted') {
      const existingToken = await getCurrentFirebaseMessagingToken().catch(() => '');
      if (existingToken) {
        return existingToken;
      }
    }

    return requestFirebaseMessagingPermissionAndToken();
  };

  const handleMealNotificationGrantPermission = async () => {
    try {
      const token = await resolveMealNotificationToken();
      await persistMealNotificationSubscription({
        enabled: true,
        noticeMessage: '급식 알림 권한을 연결했어요.',
        tokenOverride: token,
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.code : '';
      if (errorCode === 'notifications-denied') {
        setMealNotificationError('브라우저 알림 권한을 허용한 뒤 다시 시도해 주세요.');
      } else if (errorCode === 'notifications-dismissed') {
        setMealNotificationError('알림 권한 요청이 닫혔어요. 다시 시도해 주세요.');
      } else {
        setMealNotificationError(
          error instanceof Error ? error.message : '알림 권한을 연결하지 못했어요.'
        );
      }
      setMealNotificationPermission(getBrowserNotificationPermission());
    }
  };

  const handleMealNotificationToggle = async (event) => {
    const nextEnabled = event.target.checked;

    if (!nextEnabled) {
      await persistMealNotificationSubscription({
        enabled: false,
        noticeMessage: '급식 알림을 껐어요.',
      });
      return;
    }

    try {
      const token = await resolveMealNotificationToken();
      await persistMealNotificationSubscription({
        enabled: true,
        noticeMessage: '급식 알림을 켰어요.',
        tokenOverride: token,
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.code : '';
      if (errorCode === 'notifications-denied') {
        setMealNotificationError('브라우저 알림 권한을 허용한 뒤 다시 시도해 주세요.');
      } else if (errorCode === 'notifications-dismissed') {
        setMealNotificationError('알림 권한 요청이 닫혔어요. 다시 시도해 주세요.');
      }
      setMealNotificationPermission(getBrowserNotificationPermission());
    }
  };

  const handleMealNotificationSave = async () => {
    try {
      const token = mealNotificationSubscription.enabled
        ? await resolveMealNotificationToken()
        : undefined;

      await persistMealNotificationSubscription({
        enabled: mealNotificationSubscription.enabled,
        noticeMessage: mealNotificationSubscription.enabled
          ? '급식 알림 시간을 저장했어요.'
          : '급식 알림 시간 기본값을 저장했어요.',
        tokenOverride: token,
      });
    } catch (error) {
      const errorCode = error instanceof Error ? error.code : '';
      if (errorCode === 'notifications-denied') {
        setMealNotificationError('브라우저 알림 권한을 허용한 뒤 다시 시도해 주세요.');
      }
      setMealNotificationPermission(getBrowserNotificationPermission());
    }
  };

  const handleMealNotificationDelete = async () => {
    setIsMealNotificationSaving(true);
    setMealNotificationError('');
    setMealNotificationNotice('');

    try {
      await deleteCurrentFirebaseMessagingToken().catch(() => false);
      await mealNotificationsApi.deleteSubscription(mealNotificationInstallationId);
      setMealNotificationSubscription(
        normalizeMealNotificationItem(null, mealNotificationInstallationId),
      );
      setMealNotificationPermission(getBrowserNotificationPermission());
      setMealNotificationNotice('이 기기의 급식 알림 등록을 완전히 해제했어요.');
    } catch (error) {
      setMealNotificationError(
        error instanceof Error ? error.message : '급식 알림 등록을 해제하지 못했어요.'
      );
    } finally {
      setIsMealNotificationSaving(false);
    }
  };

  const handleMealNotificationInstallClick = async () => {
    setMealNotificationError('');
    setMealNotificationNotice('');

    try {
      const outcome = await promptInstall();
      if (outcome === 'manual' && isIosManualInstall) {
        setMealNotificationNotice('Safari 공유 메뉴에서 "홈 화면에 추가"를 눌러 설치해 주세요.');
      }
    } catch (error) {
      setMealNotificationError(
        error instanceof Error ? error.message : 'PWA 설치 안내를 열지 못했어요.'
      );
    }
  };

  const updateRoute = (nextState) => {
    const nextParams = new URLSearchParams();
    nextParams.set('tab', nextState.tab);
    nextParams.set('date', nextState.dateKey);
    nextParams.set('month', nextState.monthKey);

    startTransition(() => {
      setSearchParams(nextParams);
    });
  };

  const handleTabChange = (tabId) => {
    if (tabId === routeState.tab) {
      return;
    }

    if (tabId === 'today') {
      pendingTodayRailScrollRef.current = true;
      const nextDateKey = routeState.todayRailKeys.has(routeState.dateKey)
        ? routeState.dateKey
        : formatDateKey(referenceDate);

      updateRoute({
        tab: 'today',
        dateKey: nextDateKey,
        monthKey: formatMonthKey(parseDateKey(nextDateKey) || referenceDate),
      });

      return;
    }

    updateRoute({
      tab: 'month',
      dateKey: routeState.dateKey,
      monthKey: routeState.monthKey,
    });
  };

  const handleTodayDateSelect = (dateKey) => {
    updateRoute({
      tab: 'today',
      dateKey,
      monthKey: formatMonthKey(parseDateKey(dateKey) || referenceDate),
    });
  };

  const handleMonthChange = (monthKey) => {
    const monthEntries = getMonthEntries(monthKey, mealEntriesByDate);
    const nextDateKey = routeState.dateKey.startsWith(monthKey)
      ? routeState.dateKey
      : monthKey === referenceMonthKey
        ? formatDateKey(referenceDate)
        : monthEntries[0]?.date || routeState.dateKey;

    updateRoute({
      tab: 'month',
      dateKey: nextDateKey,
      monthKey,
    });
  };

  const handleCalendarDateSelect = (dateKey) => {
    updateRoute({
      tab: 'month',
      dateKey,
      monthKey: formatMonthKey(parseDateKey(dateKey) || referenceDate),
    });
  };

  const handleRatingSelect = async (category, score) => {
    const availability = getRatingAvailability(category, selectedDate, referenceDate, selectedEntry);

    if (!availability.canRate) {
      setRatingError(availability.reason);
      return;
    }

    if (!selectedEntry || selectedEntry.isNoMeal) {
      return;
    }

    const requestKey = `${selectedEntry.date}:${category}:${score}`;
    setRatingError('');
    setSubmittingRatingKey(requestKey);

    try {
      const ratings = await mealsApi.submitRating(selectedEntry.date, category, score);
      setMealEntriesByDate((previous) => {
        const currentEntry = previous[selectedEntry.date];
        if (!currentEntry) {
          return previous;
        }

        return {
          ...previous,
          [selectedEntry.date]: {
            ...currentEntry,
            ratings,
          },
        };
      });
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : '급식 평점을 저장하지 못했어요.');
    } finally {
      setSubmittingRatingKey('');
    }
  };

  const showMealNotificationInstallCallout = !isInstalled;
  const showMealNotificationUnsupportedCallout =
    isInstalled &&
    !isMealNotificationLoading &&
    (!isMealNotificationConfigured || mealNotificationSupported === false);
  const showMealNotificationControls =
    isInstalled &&
    !isMealNotificationLoading &&
    isMealNotificationConfigured &&
    mealNotificationSupported === true;
  const showMealNotificationPermissionButton =
    showMealNotificationControls &&
    mealNotificationPermission !== 'granted' &&
    !mealNotificationSubscription.hasToken;
  const mealNotificationPermissionDenied = mealNotificationPermission === 'denied';

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">학교 생활 정보</p>
          <h1>오늘의 급식</h1>
          <p className="lede">
            오늘 전후의 점심 메뉴를 가볍게 훑어보고, 달력으로 이달 급식 흐름까지 한 번에
            확인할 수 있어요.
          </p>
        </div>
      </div>

      {isMealsLoading || mealLoadError ? (
        <div className={`${styles.pageNotice} ${mealLoadError ? styles.pageNoticeError : ''}`}>
          {mealLoadError || '실제 급식 정보를 불러오는 중입니다.'}
        </div>
      ) : null}

      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <p className={styles.heroKicker}>{getRelativeLabel(selectedDate, referenceDate)}</p>
          <div className={styles.heroTitleRow}>
            <div className={styles.heroDayToken}>
              {String(selectedDate.getDate()).padStart(2, '0')}
            </div>
            <div>
              <h2 className={styles.heroTitle}>
                {selectedEntry?.isNoMeal ? '오늘은 운영되는 점심이 없어요.' : '점심 메뉴를 확인해보세요.'}
              </h2>
              <p className={styles.heroDate}>{formatHeroDate(selectedDate)}</p>
            </div>
          </div>
          <p className={`${styles.heroPreview} ${selectedMenuItems.length ? '' : styles.heroFallback}`}>
            {selectedMenuText}
          </p>
        </div>
      </section>

      <section className={styles.notificationCard}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>PWA 급식 알림</p>
            <h2 className={styles.sectionTitle}>설치한 기기에서만 오늘 점심 알림을 받을 수 있어요</h2>
          </div>
          <p className={styles.sectionDescription}>
            알림 시간은 KST 기준으로 저장되고, 같은 기기에는 하루에 한 번만 전송됩니다.
          </p>
        </div>

        {mealNotificationError ? (
          <div className={`${styles.pageNotice} ${styles.pageNoticeError}`}>
            {mealNotificationError}
          </div>
        ) : null}

        {mealNotificationNotice ? (
          <div className={styles.pageNotice}>{mealNotificationNotice}</div>
        ) : null}

        {showMealNotificationInstallCallout ? (
          <div className={styles.notificationStateCard}>
            <div className={styles.notificationStateCopy}>
              <span className={styles.notificationStateIcon}>
                <Smartphone size={18} />
              </span>
              <div>
                <h3 className={styles.notificationStateTitle}>
                  급식 알림은 홈 화면에 설치한 뒤 사용할 수 있어요.
                </h3>
                <p className={styles.notificationStateDescription}>
                  PWA로 설치하면 기기별 알림 시간을 저장하고 오늘 급식을 푸시로 받아볼 수 있어요.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleMealNotificationInstallClick}
            >
              <Download size={16} />
              홈 화면에 추가
            </button>
          </div>
        ) : null}

        {isInstalled && isMealNotificationLoading ? (
          <div className={styles.notificationStateCard}>
            <div className={styles.notificationStateCopy}>
              <span className={styles.notificationStateIcon}>
                <Bell size={18} />
              </span>
              <div>
                <h3 className={styles.notificationStateTitle}>급식 알림 설정을 확인하는 중이에요.</h3>
                <p className={styles.notificationStateDescription}>
                  이 기기에서 푸시 알림을 사용할 수 있는지 확인하고 있어요.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showMealNotificationUnsupportedCallout ? (
          <div className={styles.notificationStateCard}>
            <div className={styles.notificationStateCopy}>
              <span className={styles.notificationStateIcon}>
                <BellOff size={18} />
              </span>
              <div>
                <h3 className={styles.notificationStateTitle}>
                  현재 기기/브라우저에서는 급식 알림을 지원하지 않아요.
                </h3>
                <p className={styles.notificationStateDescription}>
                  Firebase Web Push를 지원하는 환경에서 설치된 PWA로 열면 이 기능을 사용할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showMealNotificationControls ? (
          <div className={styles.notificationControls}>
            <label className={styles.notificationToggleRow}>
              <div className={styles.notificationToggleCopy}>
                <span className={styles.notificationToggleTitle}>알림 받기</span>
                <span className={styles.notificationToggleDescription}>
                  설정한 시간에 오늘 급식 메뉴를 이 기기로 보내드려요.
                </span>
              </div>
              <input
                type="checkbox"
                className={styles.notificationToggle}
                checked={mealNotificationSubscription.enabled}
                onChange={handleMealNotificationToggle}
                disabled={isMealNotificationSaving || mealNotificationPermissionDenied}
              />
            </label>

            <div className={styles.notificationSchedulePanel}>
              <MealNotificationTimePicker
                value={mealNotificationSubscription.notificationTime}
                onChange={handleMealNotificationTimeChange}
                disabled={isMealNotificationSaving || mealNotificationPermissionDenied}
              />

              <div className={styles.notificationTimezoneCard}>
                <span className={styles.notificationFieldLabel}>기준 시간대</span>
                <strong className={styles.notificationTimezoneValue}>
                  {mealNotificationSubscription.timezone}
                </strong>
                <p className={styles.notificationTimezoneHint}>
                  저장과 발송은 한국 표준시 기준으로 처리됩니다.
                </p>
              </div>
            </div>

            <div className={styles.notificationMetaRow}>
              <span>
                브라우저 권한: {mealNotificationPermission === 'granted'
                  ? '허용됨'
                  : mealNotificationPermission === 'denied'
                    ? '거부됨'
                    : '미요청'}
              </span>
              <span>기기 등록: {mealNotificationSubscription.hasToken ? '완료' : '미등록'}</span>
              {mealNotificationSubscription.lastSentMealDate ? (
                <span>마지막 발송: {mealNotificationSubscription.lastSentMealDate}</span>
              ) : null}
            </div>

            {showMealNotificationPermissionButton ? (
              <div className={styles.notificationHint}>
                <p>
                  먼저 이 브라우저의 알림 권한을 허용해야 급식 알림을 켤 수 있어요.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleMealNotificationGrantPermission}
                  disabled={isMealNotificationSaving}
                >
                  <Bell size={16} />
                  알림 권한 허용
                </button>
              </div>
            ) : null}

            {mealNotificationPermissionDenied ? (
              <div className={styles.notificationHint}>
                <p>
                  브라우저 또는 기기 설정에서 알림 권한을 다시 허용한 뒤 시도해 주세요.
                </p>
              </div>
            ) : null}

            <div className={styles.notificationActionRow}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleMealNotificationSave}
                disabled={isMealNotificationSaving}
              >
                {isMealNotificationSaving ? '저장 중...' : '설정 저장'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleMealNotificationDelete}
                disabled={isMealNotificationSaving}
              >
                기기 등록 해제
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.tabSection}>
        <div className={styles.tabBar} role="tablist" aria-label="급식 보기 방식">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`meal-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={routeState.tab === tab.id}
              aria-controls={`meal-panel-${tab.id}`}
              className={`${styles.tabButton} ${
                routeState.tab === tab.id ? styles.tabButtonActive : ''
              }`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {routeState.tab === 'today' ? (
          <section
            id="meal-panel-today"
            role="tabpanel"
            aria-labelledby="meal-tab-today"
            className={styles.panel}
          >
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>오늘 기준 ±7일</p>
                <h2 className={styles.sectionTitle}>지나간 급식과 예정 급식을 이어서 보기</h2>
              </div>
              <p className={styles.sectionDescription}>
                가로 레일을 넘기며 최근 급식과 다가올 점심을 빠르게 훑어보세요.
              </p>
            </div>

            <div
              ref={todayRailScrollerRef}
              className={styles.railScroller}
              aria-label="급식 날짜 레일"
            >
              {todayRailEntries.map(({ date, dateKey, entry }) => {
                const statusLabel = entry ? getMealStatusLabel(entry, referenceDate) : '급식 없음';
                const isActive = routeState.dateKey === dateKey;
                const railMenuText = getMealMenuText(entry?.menuItems)
                  || entry?.note
                  || '급식 정보 없음';

                return (
                  <button
                    key={dateKey}
                    ref={dateKey === todayDateKey ? todayRailTodayRef : null}
                    type="button"
                    className={`${styles.railCard} ${isActive ? styles.railCardActive : ''}`}
                    onClick={() => handleTodayDateSelect(dateKey)}
                    aria-pressed={isActive}
                  >
                    <span className={`${styles.statusBadge} ${styles[`status-${entry?.status || 'empty'}`]}`}>
                      {statusLabel}
                    </span>
                    <div className={styles.railHeader}>
                      <strong className={styles.railDate}>{formatRailDate(date)}</strong>
                      <span className={styles.railWeekday}>{formatWeekday(date)}</span>
                    </div>
                    <p className={styles.railRelative}>{getRelativeLabel(date, referenceDate)}</p>
                    <span className={styles.railSelectionHint}>날짜를 눌러 아래에서 메뉴 보기</span>
                    <p className={styles.railPreview}>{railMenuText}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section
            id="meal-panel-month"
            role="tabpanel"
            aria-labelledby="meal-tab-month"
            className={styles.panel}
          >
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>이달의 급식</p>
                <h2 className={styles.sectionTitle}>달력으로 한 달 메뉴 흐름 보기</h2>
              </div>
              <p className={styles.sectionDescription}>
                날짜를 고르면 아래 상세 패널이 함께 바뀌어요.
              </p>
            </div>

            <div className={styles.monthSwitcher}>
              {monthOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.monthChip} ${
                    routeState.monthKey === option.key ? styles.monthChipActive : ''
                  }`}
                  onClick={() => handleMonthChange(option.key)}
                >
                  <span>{option.label}</span>
                  <small>{option.relativeLabel}</small>
                </button>
              ))}
            </div>

            <div className={styles.calendarCard}>
              <div className={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className={styles.weekdayCell}>{label}</div>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {calendarWeeks.flat().map((cell) => {
                  const isSelected = routeState.dateKey === cell.dateKey;
                  const isSelectable = visibleMonthKeys.has(formatMonthKey(cell.date));

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={`${styles.dayCell} ${
                        cell.isCurrentMonth ? '' : styles.dayCellMuted
                      } ${cell.isToday ? styles.dayCellToday : ''} ${
                        isSelected ? styles.dayCellSelected : ''
                      }`}
                      onClick={() => isSelectable && handleCalendarDateSelect(cell.dateKey)}
                      disabled={!isSelectable}
                      aria-pressed={isSelected}
                    >
                      <div className={styles.dayHeader}>
                        <span className={styles.dayNumber}>{cell.date.getDate()}</span>
                        {isSameDate(cell.date, referenceDate) ? (
                          <span className={styles.todayMarker}>TODAY</span>
                        ) : null}
                      </div>

                      <div className={styles.dayContent}>
                        {cell.entry?.menuItems?.length ? (
                          <>
                            <ul className={styles.dayMenuListDesktop}>
                              {cell.entry.menuItems.map((item) => (
                                <li key={`${cell.key}-${item}`} className={styles.dayMenuItem}>
                                  {item}
                                </li>
                              ))}
                            </ul>
                            <div className={styles.dayMenuListMobile}>
                              <span className={styles.mobileMenuCount}>메뉴 숨김</span>
                            </div>
                          </>
                        ) : (
                          <span className={styles.mobileMenuCount}>급식 없음</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>선택한 날짜의 점심</p>
              <h2 className={styles.sectionTitle}>{formatHeroDate(selectedDate)}</h2>
            </div>
            <div className={styles.detailMeta}>
              <span className={`${styles.statusBadge} ${styles[`status-${selectedEntry?.status || 'empty'}`]}`}>
                {selectedStatusLabel}
              </span>
              <span className={styles.serviceChip}>
                <Clock3 size={14} />
                {serviceLabel}
              </span>
            </div>
          </div>

          {selectedEntry?.menuItems?.length ? (
            <ul className={styles.menuList}>
              {selectedEntry.menuItems.map((item) => (
                <li key={`${selectedEntry.id}-${item}`} className={styles.menuRow}>
                  <span className={styles.menuBullet} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyMealState}>
              <Soup size={18} />
              <p>이 날짜에는 운영되는 점심 급식이 없습니다.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.reactionSection}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>급식 평점</p>
            <h2 className={styles.sectionTitle}>선택한 급식을 1점부터 5점까지 평가해보세요</h2>
          </div>
          <p className={styles.sectionDescription}>
            같은 항목은 다시 눌러 점수를 바꿀 수 있어요.
          </p>
        </div>

        {ratingError ? (
          <div className={`${styles.pageNotice} ${styles.pageNoticeError}`}>{ratingError}</div>
        ) : null}

        {selectedEntry?.isNoMeal ? (
          <article className={styles.reactionCard}>
            <div className={styles.emptyMealState}>
              <Soup size={18} />
              <p>운영되지 않는 날은 평점을 남길 수 없습니다.</p>
            </div>
          </article>
        ) : (
          <div className={styles.reactionGrid}>
            {RATING_GROUPS.map((group) => {
              const summary = selectedRatings[group.key] || createEmptyRatingSummary();
              const availability = ratingAvailabilityByKey[group.key]
                || getRatingAvailability(group.key, selectedDate, referenceDate, selectedEntry);

              return (
                <article key={group.key} className={styles.reactionCard}>
                  <div className={styles.reactionCardHeader}>
                    <div>
                      <h3 className={styles.reactionTitle}>{group.title}</h3>
                      <p className={styles.reactionDescription}>{group.description}</p>
                    </div>
                    <div className={styles.ratingSummary}>
                      <strong>{summary.averageScore !== null ? `${summary.averageScore.toFixed(1)}점` : '-'}</strong>
                      <span>{summary.totalCount}명 참여</span>
                    </div>
                  </div>

                  <div className={styles.scoreButtonGroup} role="group" aria-label={`${group.title} 평점 선택`}>
                    {RATING_SCORES.map((score) => {
                      const isActive = summary.myScore === score;
                      const isSubmitting = Boolean(submittingRatingKey);

                      return (
                        <button
                          key={`${group.key}-${score}`}
                          type="button"
                          className={`${styles.scoreButton} ${isActive ? styles.scoreButtonActive : ''}`}
                          onClick={() => handleRatingSelect(group.key, score)}
                          disabled={isSubmitting || !availability.canRate}
                          aria-pressed={isActive}
                        >
                          <Star size={14} className={styles.scoreIcon} />
                          {score}점
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.scoreDistribution}>
                    {summary.distribution.map((bucket) => (
                      <div key={`${group.key}-${bucket.score}`} className={styles.scoreRow}>
                        <span className={styles.scoreRowLabel}>{bucket.score}점</span>
                        <div className={styles.reactionBar} aria-hidden="true">
                          <div
                            className={styles.reactionFill}
                            style={{ width: `${bucket.ratio}%` }}
                          />
                        </div>
                        <span className={styles.scoreRowMeta}>
                          {bucket.count}명 · {bucket.ratio}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {!availability.canRate ? (
                    <p className={styles.ratingLockedReason}>{availability.reason}</p>
                  ) : null}

                  <p className={styles.ratingFootnote}>
                    {summary.myScore ? `내 평가: ${summary.myScore}점` : '아직 내 평가가 없습니다.'}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.supportSection}>
        <article className={styles.detailCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>영양 정보</p>
              <h2 className={styles.sectionTitle}>칼로리와 주요 영양소</h2>
            </div>
            <p className={styles.sectionDescription}>
              급식 평점 아래에서 칼로리와 제공된 영양 정보를 바로 확인할 수 있어요.
            </p>
          </div>

          {selectedCalorieText || selectedNutritionItems.length ? (
            <div className={styles.nutritionPanel}>
              {selectedCalorieText ? (
                <div className={styles.nutritionHighlight}>
                  <span className={styles.nutritionLabel}>총 열량</span>
                  <strong className={styles.nutritionValue}>{selectedCalorieText}</strong>
                </div>
              ) : null}

              {selectedNutritionItems.length ? (
                <ul className={styles.nutritionList}>
                  {selectedNutritionItems.map((item) => (
                    <li key={`${selectedEntry?.id || routeState.dateKey}-${item}`} className={styles.nutritionItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className={styles.emptyMealState}>
              <Info size={18} />
              <p>이 날짜에는 제공된 칼로리 또는 영양 정보가 없습니다.</p>
            </div>
          )}
        </article>
      </section>

      <section className={styles.allergySection}>
        <article className={styles.detailCard}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>알레르기 정보</p>
              <h2 className={styles.sectionTitle}>식단표 숫자 표기를 함께 확인하세요</h2>
            </div>
            <p className={styles.sectionDescription}>
              메뉴명 뒤 숫자 표기가 있을 경우 아래 알레르기 유발 식품 번호를 참고해 주세요.
            </p>
          </div>

          <ul className={styles.allergyList}>
            {ALLERGY_INFO.map((item) => (
              <li key={item} className={styles.allergyItem}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
