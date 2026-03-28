/**
 * @file src/api/mocks/notices.mock.js
 * @description Implements deterministic mock API behavior for development fallback scenarios.
 * Responsibilities:
 * - Provide in-memory mock responses that mirror backend contracts and pagination semantics.
 * Key dependencies:
 * - ../../config/env
 * Side effects:
 * - Mutates in-memory mock state to emulate backend persistence semantics.
 * - Interacts with browser runtime APIs.
 * - Schedules deferred work using timer-based execution.
 * Role in app flow:
 * - Supports local and development flows when network-backed API calls are unavailable.
 */
import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../../config/env';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;
const BUDGET_MONTH_ORDER = ['03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02'];
const BUDGET_START_YEAR = 2026;
const BUDGET_END_YEAR = 2026;

function getCurrentBudgetCycle(date = new Date()) {
  const month = date.getMonth() + 1;
  const budgetYear = month >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    currentBudgetYear: budgetYear,
    currentBudgetMonth: String(month).padStart(2, '0'),
  };
}

function clampBudgetYear(year) {
  return Math.max(BUDGET_START_YEAR, Math.min(BUDGET_END_YEAR, year));
}

function normalizeBudgetNoticeFields(notice) {
  if (notice.category !== 'budget') {
    return notice;
  }

  // Mirror the backend serializer so budget board pages can swap between live
  // and mock data without branching on field formats.
  return {
    ...notice,
    budgetYear: String(notice.budgetYear),
    budgetMonth: String(notice.budgetMonth).padStart(2, '0'),
  };
}

let mockNotices = [
  normalizeBudgetNoticeFields({
    id: '101',
    category: 'school',
    title: '중간고사 일정 및 범위 안내',
    summary: '2학년 전체 중간고사 일정과 과목별 범위를 공지합니다.',
    body: '<p>중간고사는 4월 21일(화)부터 24일(금)까지 진행됩니다. 과목별 세부 범위는 첨부 파일을 참고하세요.</p>',
    pinned: true,
    important: true,
    examRelated: true,
    tags: ['시험', '일정'],
    author: { id: '1', name: '교무부', role: 'admin' },
    createdAt: '2026-03-02T09:00:00Z',
    updatedAt: '2026-03-02T09:00:00Z',
    views: 129,
    likes: 12,
    dislikes: 1,
    myReaction: null,
    attachments: [
      {
        id: '5001',
        name: 'midterm-scope.pdf',
        size: 235000,
        url: '#',
        mime: 'application/pdf',
        kind: 'file',
      },
    ],
  }),
  normalizeBudgetNoticeFields({
    id: '102',
    category: 'council',
    title: '학생회 2분기 활동 계획 공유',
    summary: '축제 준비, 환경 캠페인, 동아리 연합회 회의 일정 공유',
    body: '<p>4월에는 교내 환경 캠페인을 진행하며, 5월에는 축제 준비에 돌입합니다.</p>',
    pinned: false,
    important: true,
    examRelated: false,
    tags: ['학생회', '행사'],
    author: { id: '2', name: '학생회장', role: 'student_council' },
    createdAt: '2026-03-05T12:00:00Z',
    updatedAt: '2026-03-05T12:00:00Z',
    views: 88,
    likes: 5,
    dislikes: 0,
    myReaction: null,
    attachments: [],
  }),
  normalizeBudgetNoticeFields({
    id: '301',
    category: 'budget',
    budgetYear: '2026',
    budgetMonth: '03',
    title: '2026년 3월 학생회 예산 집행 내역',
    summary: '개강 행사 준비와 동아리 연합 간담회 관련 3월 예산 집행 내역입니다.',
    body: '<p>3월 예산은 개강 행사 물품, 회의 간식, 홍보물 제작 비용으로 집행되었습니다.</p>',
    pinned: true,
    important: false,
    examRelated: false,
    tags: ['예산', '3월'],
    author: { id: '2', name: '학생회장', role: 'student_council' },
    createdAt: '2026-03-28T10:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
    views: 41,
    likes: 4,
    dislikes: 0,
    myReaction: null,
    attachments: [
      {
        id: '5002',
        name: 'budget-2026-03.xlsx',
        size: 184200,
        url: '#',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        kind: 'file',
      },
    ],
  }),
  normalizeBudgetNoticeFields({
    id: '302',
    category: 'budget',
    budgetYear: '2026',
    budgetMonth: '04',
    title: '2026년 4월 학생회 예산 집행 내역',
    summary: '환경 캠페인 운영 물품과 포스터 출력비를 포함한 4월 예산 공개입니다.',
    body: '<p>환경 캠페인 부스 운영을 위한 소모품과 인쇄물 비용이 반영되었습니다.</p>',
    pinned: false,
    important: false,
    examRelated: false,
    tags: ['예산', '4월'],
    author: { id: '2', name: '학생회장', role: 'student_council' },
    createdAt: '2026-04-30T09:30:00Z',
    updatedAt: '2026-04-30T09:30:00Z',
    views: 22,
    likes: 2,
    dislikes: 0,
    myReaction: null,
    attachments: [],
  }),
  normalizeBudgetNoticeFields({
    id: '303',
    category: 'budget',
    budgetYear: '2026',
    budgetMonth: '01',
    title: '2027년 1월 학생회 예산 집행 내역',
    summary: '겨울방학 프로그램과 졸업 시즌 행사 준비를 위한 1월 집행 내역입니다.',
    body: '<p>1월 집행은 졸업 시즌 행사 준비, 겨울방학 자치 프로그램 운영비 중심입니다.</p>',
    pinned: false,
    important: true,
    examRelated: false,
    tags: ['예산', '1월'],
    author: { id: '2', name: '학생회장', role: 'student_council' },
    createdAt: '2027-01-27T08:20:00Z',
    updatedAt: '2027-01-27T08:20:00Z',
    views: 16,
    likes: 1,
    dislikes: 0,
    myReaction: null,
    attachments: [],
  }),
];

const mockComments = {
  '101': [
    {
      id: '9001',
      noticeId: '101',
      body: '시험 범위 감사합니다!',
      author: { id: '11', name: '학생1', role: 'student' },
      createdAt: '2026-03-06T08:00:00Z',
      updatedAt: '2026-03-06T08:00:00Z',
    },
  ],
  '102': [],
  '301': [
    {
      id: '9002',
      noticeId: '301',
      body: '세부 내역 파일도 잘 보입니다.',
      author: { id: '12', name: '학생2', role: 'student' },
      createdAt: '2026-03-29T08:15:00Z',
      updatedAt: '2026-03-29T08:15:00Z',
    },
  ],
  '302': [],
  '303': [],
};

const mockMyReactions = {};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summarize(html) {
  const text = html.replace(/<[^>]+>/g, '');
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function applyListFilters(data, params = {}) {
  const {
    category,
    query,
    pinned,
    important,
    exam,
    sort,
    budgetYear,
    budgetMonth,
  } = params;
  let result = [...data];

  if (category) {
    result = result.filter((notice) => notice.category === category);
  }
  if (category === 'budget' && budgetYear) {
    result = result.filter((notice) => String(notice.budgetYear) === String(budgetYear));
  }
  if (category === 'budget' && budgetMonth) {
    const normalizedBudgetMonth = String(budgetMonth).padStart(2, '0');
    result = result.filter((notice) => String(notice.budgetMonth) === normalizedBudgetMonth);
  }
  if (pinned) result = result.filter((notice) => notice.pinned);
  if (important) result = result.filter((notice) => notice.important);
  if (exam) result = result.filter((notice) => notice.examRelated);
  if (query) {
    const loweredQuery = query.toLowerCase();
    result = result.filter(
      (notice) =>
        notice.title.toLowerCase().includes(loweredQuery) ||
        (notice.summary || '').toLowerCase().includes(loweredQuery) ||
        (notice.body || '').toLowerCase().includes(loweredQuery) ||
        (notice.tags || []).some((tag) => String(tag).toLowerCase().includes(loweredQuery))
    );
  }

  switch (sort) {
    case 'views':
      result.sort((left, right) => {
        if (left.pinned !== right.pinned) return right.pinned - left.pinned;
        return (right.views || 0) - (left.views || 0) || new Date(right.createdAt) - new Date(left.createdAt);
      });
      break;
    case 'important':
      result.sort((left, right) => {
        if (left.pinned !== right.pinned) return right.pinned - left.pinned;
        if (left.important !== right.important) return Number(right.important) - Number(left.important);
        return new Date(right.createdAt) - new Date(left.createdAt);
      });
      break;
    default:
      result.sort((left, right) => {
        if (left.pinned !== right.pinned) return right.pinned - left.pinned;
        return new Date(right.createdAt) - new Date(left.createdAt);
      });
  }

  return result;
}

async function getBudgetSettings() {
  await delay(80);
  const { currentBudgetYear, currentBudgetMonth } = getCurrentBudgetCycle();
  // Keep the mock payload aligned with the real settings endpoint contract.
  return {
    startYear: BUDGET_START_YEAR,
    endYear: BUDGET_END_YEAR,
    monthOrder: BUDGET_MONTH_ORDER,
    currentBudgetYear,
    currentBudgetMonth,
    defaultBudgetYear: clampBudgetYear(currentBudgetYear),
    defaultBudgetMonth: currentBudgetMonth,
  };
}

async function list(params = {}) {
  await delay(120);
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const filtered = applyListFilters(mockNotices, params);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    countdownEvent: null,
  };
}

async function get(id) {
  await delay(80);
  const hit = mockNotices.find((notice) => notice.id === String(id));
  if (!hit) throw new Error('Not found');
  return hit;
}

async function create(payload) {
  await delay(120);
  const id = String(Date.now());
  const now = new Date().toISOString();
  const withMeta = normalizeBudgetNoticeFields({
    ...payload,
    id,
    createdAt: now,
    updatedAt: now,
    summary: payload.summary || summarize(payload.body || ''),
    likes: 0,
    dislikes: 0,
    myReaction: null,
    views: payload.views || 0,
  });
  mockNotices = [withMeta, ...mockNotices];
  mockComments[id] = [];
  return withMeta;
}

async function update(id, payload) {
  await delay(120);
  mockNotices = mockNotices.map((notice) =>
    notice.id === String(id)
      ? normalizeBudgetNoticeFields({
          ...notice,
          ...payload,
          summary: payload.summary || summarize(payload.body || notice.body || ''),
          updatedAt: new Date().toISOString(),
        })
      : notice
  );
  return mockNotices.find((notice) => notice.id === String(id));
}

async function remove(id) {
  await delay(80);
  mockNotices = mockNotices.filter((notice) => notice.id !== String(id));
  delete mockComments[String(id)];
  return { success: true };
}

function resolveReactionState(noticeId) {
  const notice = mockNotices.find((item) => item.id === String(noticeId));
  if (!notice) throw new Error('Not found');
  const current = mockMyReactions[noticeId] || null;
  return { notice, current };
}

async function react(noticeId, type) {
  await delay(60);
  const { notice, current } = resolveReactionState(noticeId);
  if (current === type) {
    mockMyReactions[noticeId] = null;
    if (type === 'like' && notice.likes > 0) notice.likes -= 1;
    if (type === 'dislike' && notice.dislikes > 0) notice.dislikes -= 1;
  } else {
    if (current === 'like' && notice.likes > 0) notice.likes -= 1;
    if (current === 'dislike' && notice.dislikes > 0) notice.dislikes -= 1;
    mockMyReactions[noticeId] = type;
    if (type === 'like') notice.likes += 1;
    else notice.dislikes += 1;
  }
  notice.myReaction = mockMyReactions[noticeId];
  return {
    likes: notice.likes,
    dislikes: notice.dislikes,
    myReaction: notice.myReaction,
  };
}

async function listComments(noticeId, params = {}) {
  await delay(60);
  const comments = mockComments[String(noticeId)] || [];
  const pageSize = params.pageSize || 20;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const items = comments.slice(start, start + pageSize);
  return {
    items,
    total: comments.length,
    page,
    pageSize,
  };
}

async function createComment(noticeId, body) {
  await delay(60);
  const now = new Date().toISOString();
  const comment = {
    id: String(Date.now()),
    noticeId: String(noticeId),
    body,
    author: { id: '999', name: '나', role: 'student' },
    createdAt: now,
    updatedAt: now,
  };
  mockComments[String(noticeId)] = [comment, ...(mockComments[String(noticeId)] || [])];
  return comment;
}

async function deleteComment(noticeId, commentId) {
  await delay(40);
  mockComments[String(noticeId)] = (mockComments[String(noticeId)] || []).filter(
    (comment) => comment.id !== String(commentId)
  );
  return { success: true };
}

async function upload(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
  }
  await delay(120);
  const url = URL.createObjectURL(file);
  return {
    id: String(Date.now()),
    name: file.name,
    size: file.size,
    url,
    mime: file.type || 'application/octet-stream',
    kind: file.type?.startsWith('image/') ? 'image' : 'file',
  };
}

export const noticesMockApi = {
  getBudgetSettings,
  list,
  get,
  create,
  update,
  remove,
  react,
  listComments,
  createComment,
  deleteComment,
  upload,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};
