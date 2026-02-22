/**
 * @file src/api/mocks/clubRecruit.mock.js
 * @description Implements deterministic mock API behavior for development fallback scenarios.
 * Responsibilities:
 * - Provide in-memory mock responses that mirror backend contracts and pagination semantics.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - Mutates in-memory mock state to emulate backend persistence semantics.
 * - Interacts with browser runtime APIs.
 * - Schedules deferred work using timer-based execution.
 * Role in app flow:
 * - Supports local and development flows when network-backed API calls are unavailable.
 */
const PAGE_SIZE_DEFAULT = 12;

const mockItems = [
  {
    id: 'cr-1',
    clubName: '코딩나무',
    field: 'IT·개발',
    gradeGroup: 'lower',
    posterUrl: '',
    extraNote: '프로그래밍 기초부터 앱 출시까지 함께',
    applyPeriod: { start: '2026-03-01', end: '2026-03-20' },
    applyLink: '#',
    status: 'approved',
  },
  {
    id: 'cr-2',
    clubName: '마이크로비트',
    field: '메이커',
    gradeGroup: 'upper',
    posterUrl: '',
    extraNote: '하드웨어·회로 체험 위주, 매주 목요일',
    applyPeriod: { start: '2026-03-05', end: '2026-03-25' },
    applyLink: '#',
    status: 'approved',
  },
  {
    id: 'cr-3',
    clubName: 'CREW',
    field: '댄스/공연',
    gradeGroup: 'lower',
    posterUrl: '',
    extraNote: '공연팀·영상팀 동시 모집',
    applyPeriod: { start: '2026-03-01', end: null },
    applyLink: '#',
    status: 'approved',
  },
  {
    id: 'cr-4',
    clubName: '오케스트라',
    field: '음악',
    gradeGroup: 'upper',
    posterUrl: '',
    extraNote: '바이올린/플루트 우대, 합주 경험 필수',
    applyPeriod: { start: '2026-03-02', end: '2026-03-15' },
    applyLink: '#',
    status: 'pending',
  },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(v) {
  return (v || '').toLowerCase();
}

function applyFilters(items, params = {}) {
  const { gradeGroup, field, q, status, sort = 'recent' } = params;
  let data = [...items];

  if (gradeGroup === 'lower' || gradeGroup === 'upper') {
    data = data.filter((i) => i.gradeGroup === gradeGroup);
  }
  if (field && field !== 'all') {
    data = data.filter((i) => i.field === field);
  }
  if (q) {
    const qq = normalizeText(q);
    data = data.filter(
      (i) =>
        normalizeText(i.clubName).includes(qq) ||
        normalizeText(i.extraNote).includes(qq) ||
        normalizeText(i.field).includes(qq)
    );
  }

  if (status === 'approved' || status === 'pending') {
    data = data.filter((i) => i.status === status);
  }

  if (sort === 'deadline') {
    data.sort((a, b) => {
      const aEnd = a.applyPeriod?.end ? new Date(a.applyPeriod.end).getTime() : Infinity;
      const bEnd = b.applyPeriod?.end ? new Date(b.applyPeriod.end).getTime() : Infinity;
      return aEnd - bEnd;
    });
  } else {
    data.sort((a, b) => new Date(b.applyPeriod?.start || b.id) - new Date(a.applyPeriod?.start || a.id));
  }

  return data;
}

async function list(params = {}) {
  await delay(120);
  const pageSize = params.pageSize || PAGE_SIZE_DEFAULT;
  const page = params.page || 1;
  const filtered = applyFilters(mockItems, params);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

async function get(id) {
  await delay(80);
  const item = mockItems.find((i) => i.id === id);
  if (!item) throw new Error('not found');
  return item;
}

async function create(payload) {
  await delay(120);
  const now = new Date().toISOString();
  const item = {
    ...payload,
    id: `cr-${Date.now()}`,
    status: 'pending',
    createdAt: now,
  };
  mockItems.unshift(item);
  return item;
}

async function upload(file) {
  if (!file) throw new Error('파일이 없습니다.');
  await delay(80);
  const url = URL.createObjectURL(file);
  return { url, name: file.name, size: file.size, id: `poster-${Date.now()}` };
}

export const clubRecruitMockApi = {
  list,
  get,
  create,
  upload,
};




