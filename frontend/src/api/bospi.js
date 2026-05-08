/**
 * @file src/api/bospi.js
 * @description BOSPI API wrapper and response normalization.
 */
import api from './auth';

const MANAGER_ROLES = ['admin', 'student_council'];

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSettings(settings = {}) {
  return {
    rewardPoints: toSafeNumber(settings.rewardPoints, 10),
  };
}

function normalizeRecord(record = {}) {
  // The backend accepts count-based input and returns the derived ratio with
  // four-decimal precision, while older payloads may still use snake_case keys.
  const baselineStudentCount =
    record.baselineStudentCount ?? record.baseline_student_count ?? null;
  const uniformedStudentCount =
    record.uniformedStudentCount ?? record.uniformed_student_count ?? null;

  return {
    id: record.id ?? null,
    date: record.date ? String(record.date).slice(0, 10) : '',
    ratio: toSafeNumber(record.ratio),
    baselineStudentCount: toOptionalNumber(baselineStudentCount),
    uniformedStudentCount: toOptionalNumber(uniformedStudentCount),
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
  };
}

function normalizePrediction(prediction) {
  if (!prediction || typeof prediction !== 'object') return null;

  return {
    id: prediction.id ?? null,
    targetDate: prediction.targetDate ? String(prediction.targetDate).slice(0, 10) : '',
    direction: prediction.direction ?? null,
    pointsAwarded: toSafeNumber(prediction.pointsAwarded),
    isCorrect: prediction.isCorrect ?? null,
    status: prediction.status ?? 'pending',
    evaluatedAt: prediction.evaluatedAt ?? null,
    createdAt: prediction.createdAt ?? null,
    updatedAt: prediction.updatedAt ?? null,
  };
}

function normalizeComparison(comparison = {}) {
  return {
    date: comparison.date ? String(comparison.date).slice(0, 10) : '',
    outcome: comparison.outcome ?? null,
  };
}

function normalizeRanking(row = {}) {
  // Ranking rows expose only the public pending prediction shape, not the full
  // prediction history for another user.
  return {
    rank: toSafeNumber(row.rank),
    userId: row.userId ?? row.user_id ?? null,
    nickname: row.nickname ? String(row.nickname) : '알 수 없음',
    totalScore: toSafeNumber(row.totalScore ?? row.total_score),
    correctCount: toSafeNumber(row.correctCount ?? row.correct_count),
    incorrectCount: toSafeNumber(row.incorrectCount ?? row.incorrect_count),
    nextPrediction: normalizePrediction(row.nextPrediction ?? row.next_prediction),
    isCurrentUser: Boolean(row.isCurrentUser ?? row.is_current_user),
  };
}

function normalizeState(data = {}) {
  return {
    settings: normalizeSettings(data.settings),
    records: Array.isArray(data.records) ? data.records.map(normalizeRecord) : [],
    comparisons: Array.isArray(data.comparisons)
      ? data.comparisons.map(normalizeComparison)
      : [],
    predictionTargetDate: data.predictionTargetDate
      ? String(data.predictionTargetDate).slice(0, 10)
      : null,
    predictionOpen: Boolean(data.predictionOpen),
    myPrediction: normalizePrediction(data.myPrediction),
    myPredictions: Array.isArray(data.myPredictions)
      ? data.myPredictions.map(normalizePrediction).filter(Boolean)
      : [],
    myScore: toSafeNumber(data.myScore),
    rankings: Array.isArray(data.rankings) ? data.rankings.map(normalizeRanking) : [],
    canManage: Boolean(data.canManage),
    today: data.today ? String(data.today).slice(0, 10) : '',
  };
}

export const bospiApi = {
  managerRoles: MANAGER_ROLES,

  canManage(user) {
    return MANAGER_ROLES.includes(user?.role);
  },

  async getState() {
    const res = await api.get('/api/community/bospi');
    return normalizeState(res.data);
  },

  async predict(direction) {
    const res = await api.post('/api/community/bospi/predictions', { direction });
    return normalizeState(res.data);
  },

  async saveRecord(payload) {
    // Managers submit counts only; the server owns BOSPI ratio calculation and
    // rejects counts that cannot produce a valid percentage.
    const res = await api.post('/api/community/bospi/records', {
      date: payload?.date,
      baselineStudentCount: payload?.baselineStudentCount,
      uniformedStudentCount: payload?.uniformedStudentCount,
    });
    return normalizeState(res.data);
  },
};

export default bospiApi;
