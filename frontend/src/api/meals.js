import { fastapiApi } from './fastapiClient';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { getMealEntriesByDate, getMealEntryForDate } from '../features/meals/data';
import { addDays, formatDateKey, getReferenceDate, parseDateKey } from '../features/meals/utils';

const MEAL_RATING_SCORES = [1, 2, 3, 4, 5];

function buildEmptyRatingSummary() {
  return {
    averageScore: null,
    totalCount: 0,
    myScore: null,
    distribution: MEAL_RATING_SCORES.map((score) => ({
      score,
      count: 0,
      ratio: 0,
    })),
  };
}

function normalizeRatingSummary(summary) {
  const bucketsByScore = new Map(
    (Array.isArray(summary?.distribution) ? summary.distribution : []).map((bucket) => {
      const score = Number(bucket?.score);
      const count = Number(bucket?.count || 0);
      const ratio = Number(bucket?.ratio || 0);

      return [
        score,
        {
          score,
          count: Number.isFinite(count) && count >= 0 ? count : 0,
          ratio: Number.isFinite(ratio) && ratio >= 0 ? ratio : 0,
        },
      ];
    }),
  );

  const distribution = MEAL_RATING_SCORES.map((score) => bucketsByScore.get(score) || {
    score,
    count: 0,
    ratio: 0,
  });
  const derivedTotalCount = distribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const providedTotalCount = Number(summary?.totalCount);
  const totalCount = Number.isFinite(providedTotalCount) && providedTotalCount >= 0
    ? providedTotalCount
    : derivedTotalCount;
  const providedAverageScore = Number(summary?.averageScore);
  const averageScore = Number.isFinite(providedAverageScore)
    ? providedAverageScore
    : totalCount > 0
      ? Number(
          (
            distribution.reduce((sum, bucket) => sum + (bucket.score * bucket.count), 0) / totalCount
          ).toFixed(1),
        )
      : null;
  const myScore = MEAL_RATING_SCORES.includes(Number(summary?.myScore))
    ? Number(summary.myScore)
    : null;

  return {
    averageScore,
    totalCount,
    myScore,
    distribution: distribution.map((bucket) => ({
      ...bucket,
      ratio: totalCount > 0
        ? (Number.isFinite(bucket.ratio) && bucket.ratio > 0 ? bucket.ratio : Math.round((bucket.count / totalCount) * 100))
        : 0,
    })),
  };
}

function normalizeMealRatings(ratings) {
  return {
    taste: normalizeRatingSummary(ratings?.taste || buildEmptyRatingSummary()),
    anticipation: normalizeRatingSummary(ratings?.anticipation || buildEmptyRatingSummary()),
  };
}

function normalizeMealEntry(entry, fallbackDateKey = '') {
  const normalizedDate = typeof entry?.date === 'string' && entry.date ? entry.date : fallbackDateKey;
  const isNoMeal = Boolean(entry?.isNoMeal);

  return {
    id: String(entry?.id || `meal-${normalizedDate}`),
    date: normalizedDate,
    status: typeof entry?.status === 'string' ? entry.status : isNoMeal ? 'empty' : 'today',
    service: entry?.service || 'lunch',
    serviceLabel: entry?.serviceLabel || '중식',
    menuItems: Array.isArray(entry?.menuItems) ? entry.menuItems.filter(Boolean).map(String) : [],
    previewText: String(entry?.previewText || (isNoMeal ? '급식 정보가 없습니다.' : '급식 정보를 불러오는 중입니다.')),
    note: String(entry?.note || (isNoMeal ? '주말, 휴일 또는 미제공일입니다.' : '잠시만 기다려 주세요.')),
    isNoMeal,
    calorieText: entry?.calorieText || null,
    caloriesKcal:
      typeof entry?.caloriesKcal === 'number' && Number.isFinite(entry.caloriesKcal)
        ? entry.caloriesKcal
        : null,
    originItems: Array.isArray(entry?.originItems) ? entry.originItems.filter(Boolean).map(String) : [],
    nutritionItems: Array.isArray(entry?.nutritionItems)
      ? entry.nutritionItems.filter(Boolean).map(String)
      : [],
    ratings: normalizeMealRatings(entry?.ratings),
    syncedAt: entry?.syncedAt || null,
  };
}

function getMealErrorMessage(error, fallbackMessage) {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim();
  }

  const directMessage = error?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  return fallbackMessage;
}

function buildFallbackRangeItems(fromDateKey, toDateKey) {
  const fromDate = parseDateKey(fromDateKey);
  const toDate = parseDateKey(toDateKey);
  const referenceDate = getReferenceDate();
  const midpoint = fromDate && toDate
    ? new Date(Math.round((fromDate.getTime() + toDate.getTime()) / 2))
    : referenceDate;
  const entriesByDate = getMealEntriesByDate(midpoint);
  const items = [];

  if (!fromDate || !toDate) {
    return items;
  }

  for (
    let cursor = getReferenceDate(fromDate);
    cursor.getTime() <= toDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const dateKey = formatDateKey(cursor);
    items.push(normalizeMealEntry(entriesByDate[dateKey], dateKey));
  }

  return items;
}

export const mealsApi = {
  async getToday() {
    try {
      const response = await fastapiApi.get('/api/school-info/meals/today');
      return normalizeMealEntry(response.data?.item, response.data?.meta?.date);
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throw new Error(getMealErrorMessage(error, '오늘 급식 정보를 불러오지 못했어요.'));
      }

      const referenceDate = getReferenceDate();
      return normalizeMealEntry(getMealEntryForDate(formatDateKey(referenceDate), referenceDate));
    }
  },

  async listRange(fromDateKey, toDateKey) {
    try {
      const response = await fastapiApi.get('/api/school-info/meals', {
        params: {
          from: fromDateKey,
          to: toDateKey,
        },
      });

      const items = Array.isArray(response.data?.items) ? response.data.items : [];
      return items.map((item) => normalizeMealEntry(item, item?.date));
    } catch (error) {
      if (!shouldUseMockFallback(error)) {
        throw new Error(getMealErrorMessage(error, '급식 정보를 불러오지 못했어요.'));
      }

      return buildFallbackRangeItems(fromDateKey, toDateKey);
    }
  },

  async submitRating(dateKey, category, score) {
    try {
      const response = await fastapiApi.post(`/api/school-info/meals/${dateKey}/ratings`, {
        category,
        score,
      });
      return normalizeMealRatings(response.data?.ratings);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '급식 평점을 저장하지 못했어요.'));
    }
  },
};

export const mealsMockFallbackEnabled = ENABLE_API_MOCKS;
