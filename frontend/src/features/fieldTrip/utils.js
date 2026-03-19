import {
  FIELD_TRIP_CLASS_IDS,
  FIELD_TRIP_MANAGER_ROLES,
  FIELD_TRIP_TABS,
  FIELD_TRIP_UNLOCK_STORAGE_KEY,
} from './constants';
import { getFirstBodyImageUrl } from './thumbnail';
import { toPlainText } from '../../security/htmlSanitizer';

const CLASS_ID_SET = new Set(FIELD_TRIP_CLASS_IDS);
const TAB_KEY_SET = new Set(FIELD_TRIP_TABS.map((tab) => tab.key));

const CREATED_AT_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function getSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function parseUnlockedClasses(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => String(value || ''))
      .filter((value) => CLASS_ID_SET.has(value));
  } catch {
    return [];
  }
}

export function isFieldTripTab(value) {
  return typeof value === 'string' && TAB_KEY_SET.has(value);
}

export function normalizeFieldTripTab(value) {
  return isFieldTripTab(value) ? value : 'mission';
}

export function isFieldTripClassId(value) {
  return typeof value === 'string' && CLASS_ID_SET.has(value);
}

export function getFieldTripClassLabel(classId) {
  return `${classId}반`;
}

export function getDefaultFieldTripBoardDescription(classLabel) {
  return `비밀번호를 확인하면 ${classLabel} 학생들만 현장 기록 글을 확인하고 작성할 수 있습니다.`;
}

export function resolveFieldTripBoardDescription(classSummary) {
  const label = classSummary?.label || getFieldTripClassLabel(classSummary?.classId || '');
  const stored = String(classSummary?.boardDescription || '').trim();
  return stored || getDefaultFieldTripBoardDescription(label);
}

export function isFieldTripManagerRole(role) {
  return FIELD_TRIP_MANAGER_ROLES.includes(String(role || ''));
}

export function canEditFieldTripPost(post, user) {
  if (!post || !user) {
    return false;
  }

  // Anonymous posts never have an owning user record, so only manager roles
  // can edit them after the initial write.
  if (post.authorRole === 'anonymous') {
    return isFieldTripManagerRole(user.role);
  }

  if (isFieldTripManagerRole(user.role)) {
    return true;
  }

  return Boolean(user.id && post.authorUserId && Number(user.id) === Number(post.authorUserId));
}

export function getFieldTripHubPath(tab) {
  if (tab && isFieldTripTab(tab) && tab !== 'mission') {
    return `/community/field-trip?tab=${encodeURIComponent(tab)}`;
  }

  return '/community/field-trip';
}

export function getFieldTripClassPath(classId) {
  return `/community/field-trip/classes/${classId}`;
}

export function getFieldTripComposePath(classId) {
  return `${getFieldTripClassPath(classId)}/new`;
}

export function getFieldTripPostPath(classId, postId) {
  return `${getFieldTripClassPath(classId)}/posts/${postId}`;
}

export function getFieldTripPostEditPath(classId, postId) {
  return `${getFieldTripPostPath(classId, postId)}/edit`;
}

export function readUnlockedClassIds() {
  const storage = getSessionStorage();
  if (!storage) {
    return [];
  }

  return parseUnlockedClasses(storage.getItem(FIELD_TRIP_UNLOCK_STORAGE_KEY));
}

export function isClassUnlocked(classId) {
  return readUnlockedClassIds().includes(String(classId || ''));
}

export function persistUnlockedClass(classId) {
  if (!isFieldTripClassId(classId)) {
    return [];
  }

  const storage = getSessionStorage();
  if (!storage) {
    return [classId];
  }

  const current = new Set(readUnlockedClassIds());
  current.add(classId);
  const next = Array.from(current).sort((left, right) => Number(left) - Number(right));
  storage.setItem(FIELD_TRIP_UNLOCK_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function hydrateClassesWithUnlockState(classRows = []) {
  return classRows.map((row) => ({
    ...row,
    isUnlocked: Boolean(row.isUnlocked) || isClassUnlocked(row.classId),
  }));
}

export function formatFieldTripDate(createdAt) {
  if (!createdAt) {
    return '';
  }

  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return CREATED_AT_FORMATTER.format(parsed);
}

export function buildMissionPreview(body, maxLength = 110) {
  // Mission cards show a text-only summary even though the stored body can
  // contain rich HTML and embedded upload links.
  const normalized = toPlainText(String(body || ''))
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '본문이 아직 없습니다.';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

export function getFirstFieldTripImage(post) {
  const bodyImageUrl = getFirstBodyImageUrl(post?.body);
  if (bodyImageUrl) {
    return {
      id: `${post?.id || 'field-trip'}-body-image`,
      url: bodyImageUrl,
      kind: 'image',
      name: 'body-image',
    };
  }

  return (post?.attachments || []).find((attachment) => attachment?.kind === 'image') || null;
}

export function sortScoreRowsByClassId(rows = []) {
  return [...rows].sort((left, right) => Number(left.classId) - Number(right.classId));
}

export function getFieldTripPostCount(rows = []) {
  return rows.reduce((sum, row) => sum + Number(row.postCount || 0), 0);
}

export function getScoreboardSummary(rows = []) {
  if (!rows.length) {
    return {
      leader: null,
      averageScore: 0,
      scoreSpread: 0,
    };
  }

  const sortedByScore = [...rows].sort((left, right) => right.totalScore - left.totalScore);
  const total = rows.reduce((sum, row) => sum + Number(row.totalScore || 0), 0);
  const highest = sortedByScore[0]?.totalScore || 0;
  const lowest = sortedByScore.at(-1)?.totalScore || 0;

  return {
    leader: sortedByScore[0] || null,
    averageScore: total / rows.length,
    scoreSpread: highest - lowest,
  };
}
