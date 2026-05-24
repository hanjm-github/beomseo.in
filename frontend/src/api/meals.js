/**
 * @file src/api/meals.js
 * @description Normalizes school-meal payloads for the meal page.
 * This layer hides FastAPI wrapper shapes (`item`, `items`) and guarantees that
 * both real meals and synthesized empty days share the same client contract.
 */
import { fastapiApi } from './fastapiClient';

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
  // The backend usually sends a complete distribution, but the UI still
  // backfills missing buckets so admin charts remain structurally stable.
  // When the backend explicitly sends an empty distribution, that is a privacy
  // boundary for non-admin readers and must stay empty.
  const rawDistribution = Array.isArray(summary?.distribution) ? summary.distribution : null;
  const shouldExposeDistribution = rawDistribution === null || rawDistribution.length > 0;
  const bucketsByScore = new Map(
    (shouldExposeDistribution ? rawDistribution || [] : []).map((bucket) => {
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

  const distribution = shouldExposeDistribution
    ? MEAL_RATING_SCORES.map((score) => bucketsByScore.get(score) || {
        score,
        count: 0,
        ratio: 0,
      })
    : [];
  const derivedTotalCount = distribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const providedTotalCount = Number(summary?.totalCount);
  const totalCount = Number.isFinite(providedTotalCount) && providedTotalCount >= 0
    ? providedTotalCount
    : derivedTotalCount;
  const providedAverageScore = Number(summary?.averageScore);
  const averageScore = Number.isFinite(providedAverageScore)
    ? providedAverageScore
    : totalCount > 0 && distribution.length > 0
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
        ? (Number.isFinite(bucket.ratio) && bucket.ratio > 0
            ? bucket.ratio
            : Math.round((bucket.count / totalCount) * 100))
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
    previewText: String(
      entry?.previewText || (isNoMeal ? '급식 정보가 없습니다.' : '급식 정보를 불러오는 중입니다.')
    ),
    note: String(
      entry?.note || (isNoMeal ? '주말 또는 미급식일입니다.' : '잠시만 기다려 주세요.')
    ),
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

  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }
  if (typeof detail?.error === 'string' && detail.error.trim()) {
    return detail.error.trim();
  }

  const directMessage = error?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  return fallbackMessage;
}

function normalizeCommentAuthor(author) {
  return {
    id: Number.isFinite(Number(author?.id)) ? Number(author.id) : 0,
    name: typeof author?.name === 'string' && author.name ? author.name : '탈퇴한 사용자',
    role: typeof author?.role === 'string' && author.role ? author.role : 'student',
  };
}

function normalizeMealComment(comment) {
  return {
    id: Number.isFinite(Number(comment?.id)) ? Number(comment.id) : 0,
    mealDate: typeof comment?.mealDate === 'string' ? comment.mealDate : '',
    body: typeof comment?.body === 'string' ? comment.body : '',
    approvalStatus: comment?.approvalStatus === 'approved' ? 'approved' : 'pending',
    author: normalizeCommentAuthor(comment?.author),
    approvedBy: comment?.approvedBy ? normalizeCommentAuthor(comment.approvedBy) : null,
    approvedAt: typeof comment?.approvedAt === 'string' ? comment.approvedAt : null,
    createdAt: typeof comment?.createdAt === 'string' ? comment.createdAt : null,
    updatedAt: typeof comment?.updatedAt === 'string' ? comment.updatedAt : null,
  };
}

function normalizeMealCommentsResponse(payload) {
  // The API exposes both page_size and pageSize; normalize to one client-facing key.
  const pageSize = Number(payload?.pageSize || payload?.page_size || 50);
  return {
    items: Array.isArray(payload?.items) ? payload.items.map(normalizeMealComment) : [],
    total: Number.isFinite(Number(payload?.total)) ? Number(payload.total) : 0,
    page: Number.isFinite(Number(payload?.page)) ? Number(payload.page) : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 50,
  };
}

export const mealsApi = {
  async getToday() {
    try {
      const response = await fastapiApi.get('/api/school-info/meals/today');
      // The page consumes a plain entry object, not the transport-level wrapper.
      return normalizeMealEntry(response.data?.item, response.data?.meta?.date);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '오늘 급식 정보를 불러오지 못했어요.'));
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
      // Empty days are already synthesized server-side, so the returned list can
      // be rendered directly as a complete calendar range.
      return items.map((item) => normalizeMealEntry(item, item?.date));
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '급식 정보를 불러오지 못했어요.'));
    }
  },

  async submitRating(dateKey, category, score) {
    try {
      const response = await fastapiApi.post(`/api/school-info/meals/${dateKey}/ratings`, {
        category,
        score,
      });
      // Ratings are returned as an aggregate snapshot so the UI can replace the
      // visible summary without issuing a second read request.
      return normalizeMealRatings(response.data?.ratings);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '급식 평점을 저장하지 못했어요.'));
    }
  },

  async listComments(dateKey, { page = 1, pageSize = 50, order = 'asc' } = {}) {
    try {
      const response = await fastapiApi.get(`/api/school-info/meals/${dateKey}/comments`, {
        params: {
          page,
          pageSize,
          order,
        },
      });
      // Visibility is resolved server-side, so the client renders exactly the returned page.
      return normalizeMealCommentsResponse(response.data);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '급식 댓글을 불러오지 못했어요.'));
    }
  },

  async createComment(dateKey, body) {
    try {
      const response = await fastapiApi.post(`/api/school-info/meals/${dateKey}/comments`, {
        body,
      });
      // Created comments may still be pending, so keep the full normalized record.
      return normalizeMealComment(response.data);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '급식 댓글을 저장하지 못했어요.'));
    }
  },

  async setCommentApproval(dateKey, commentId, approved) {
    try {
      const response = await fastapiApi.patch(
        `/api/school-info/meals/${dateKey}/comments/${commentId}/approval`,
        { approved },
      );
      // Admin moderation returns the updated row, allowing in-place list replacement.
      return normalizeMealComment(response.data);
    } catch (error) {
      throw new Error(getMealErrorMessage(error, '댓글 승인 상태를 변경하지 못했어요.'));
    }
  },
};
