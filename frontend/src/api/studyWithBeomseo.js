/**
 * @file src/api/studyWithBeomseo.js
 * @description API boundary for the Study With Beomseo class leaderboard.
 */
import api from './auth';

const SCOREBOARD_ENDPOINT = '/api/community/study-with-beomseo/scoreboard';
const SCORE_UPDATES_ENDPOINT = '/api/community/study-with-beomseo/score-updates';

export const STUDY_WITH_BEOMSEO_MANAGER_ROLES = ['admin', 'student_council'];

// Mirror the backend's fixed grade/class range so the manager form can render
// immediately before the scoreboard payload finishes loading.
export const STUDY_WITH_BEOMSEO_CLASS_OPTIONS = Array.from({ length: 3 }, (_, gradeIndex) => {
  const grade = gradeIndex + 1;
  return Array.from({ length: 10 }, (_, classIndex) => {
    const classNumber = classIndex + 1;
    const classId = `${grade}-${classNumber}`;
    return {
      classId,
      grade,
      classNumber,
      label: classId,
    };
  });
}).flat();

function toSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseClassId(value) {
  const [gradeRaw, classRaw] = String(value || '').split('-');
  const grade = Number.parseInt(gradeRaw, 10);
  const classNumber = Number.parseInt(classRaw, 10);

  return {
    grade: Number.isFinite(grade) ? grade : null,
    classNumber: Number.isFinite(classNumber) ? classNumber : null,
  };
}

function resolveClassLabel(row = {}) {
  const rawLabel = row.label ?? row.classLabel ?? row.class_label;
  if (rawLabel) return String(rawLabel);

  const classId = row.classId ?? row.class_id;
  const parsed = parseClassId(classId);
  if (parsed.grade && parsed.classNumber) {
    return `${parsed.grade}-${parsed.classNumber}`;
  }

  return String(classId || '');
}

function normalizeCreator(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    return {
      nickname: value,
      role: '',
    };
  }

  if (typeof value === 'object') {
    return {
      id: value.id ?? null,
      nickname: String(value.nickname || value.name || ''),
      role: String(value.role || ''),
    };
  }

  return null;
}

function unwrapItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function isScoreboardPayload(data) {
  return Array.isArray(data) || (data !== null && typeof data === 'object');
}

function normalizeScoreRow(row = {}, index = 0) {
  const classId = String(row.classId ?? row.class_id ?? '').trim();
  const parsed = parseClassId(classId);
  const grade = toOptionalNumber(row.grade ?? parsed.grade);
  const classNumber = toOptionalNumber(row.classNumber ?? row.class_number ?? parsed.classNumber);
  const label = resolveClassLabel(row);

  return {
    classId: classId || label,
    grade,
    classNumber,
    label,
    rank: toSafeNumber(row.rank, index + 1),
    totalScore: toSafeNumber(row.totalScore ?? row.total_score),
    lastPublishedAt: row.lastPublishedAt ?? row.last_published_at ?? null,
  };
}

function normalizePendingUpdate(update = {}) {
  // Accept both camelCase and snake_case so the UI stays stable during backend
  // serializer changes and fixture-based tests.
  const classId = String(update.classId ?? update.class_id ?? '').trim();
  const parsed = parseClassId(classId);
  const grade = toOptionalNumber(update.grade ?? parsed.grade);
  const classNumber = toOptionalNumber(update.classNumber ?? update.class_number ?? parsed.classNumber);

  return {
    id: String(update.id ?? `${classId}-${update.effectiveAt ?? update.effective_at ?? ''}`),
    classId,
    grade,
    classNumber,
    label: resolveClassLabel(update),
    totalScore: toSafeNumber(update.totalScore ?? update.total_score),
    effectiveAt: update.effectiveAt ?? update.effective_at ?? null,
    createdAt: update.createdAt ?? update.created_at ?? null,
    createdBy: normalizeCreator(update.createdBy ?? update.created_by),
  };
}

function normalizeScoreboard(data = {}) {
  return {
    serverNow: data.serverNow ?? data.server_now ?? null,
    updatedThrough: data.updatedThrough ?? data.updated_through ?? null,
    canManage: Boolean(data.canManage ?? data.can_manage),
    items: unwrapItems(data).map(normalizeScoreRow),
    pendingUpdates: Array.isArray(data.pendingUpdates ?? data.pending_updates)
      ? (data.pendingUpdates ?? data.pending_updates).map(normalizePendingUpdate)
      : [],
  };
}

export function getStudyWithBeomseoErrorMessage(error, fallbackMessage) {
  const detail = error?.response?.data?.detail;
  const serverMessage =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    (typeof detail === 'string' ? detail : detail?.error);

  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim();
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

export const studyWithBeomseoApi = {
  managerRoles: STUDY_WITH_BEOMSEO_MANAGER_ROLES,
  classOptions: STUDY_WITH_BEOMSEO_CLASS_OPTIONS,

  canManage(user) {
    return STUDY_WITH_BEOMSEO_MANAGER_ROLES.includes(user?.role);
  },

  async getScoreboard() {
    const response = await api.get(SCOREBOARD_ENDPOINT);
    if (!isScoreboardPayload(response.data)) {
      throw new TypeError('스터디 윗 범서 순위판 API가 아직 JSON 응답을 반환하지 않습니다.');
    }

    return normalizeScoreboard(response.data);
  },

  async scheduleScoreUpdate(payload) {
    // The server stores total-score snapshots, not incremental score deltas.
    const response = await api.post(SCORE_UPDATES_ENDPOINT, {
      classId: payload?.classId,
      totalScore: Number(payload?.totalScore),
      effectiveAt: payload?.effectiveAt,
    });
    return response.data;
  },
};

export default studyWithBeomseoApi;
