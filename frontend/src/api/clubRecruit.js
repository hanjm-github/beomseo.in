import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse } from './normalizers';
import { shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;

const mockItems = [
  {
    id: 'cr-1',
    clubName: '코딩나무',
    field: 'IT·개발',
    gradeGroup: 'lower', // 1·2학년
    posterUrl: '',
    extraNote: '프로그래밍 기초부터 앱 출시까지 함께',
    applyPeriod: { start: '2026-03-01', end: '2026-03-20' },
    applyLink: '#',
    status: 'open',
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
    status: 'open',
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
    status: 'open',
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
    status: 'open',
  },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeText(v) {
  return (v || '').toLowerCase();
}

function applyFilters(items, params) {
  const { gradeGroup, field, q, sort = 'recent' } = params;
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

async function mockList(params = {}) {
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

async function mockGet(id) {
  await delay(80);
  const item = mockItems.find((i) => i.id === id);
  if (!item) throw new Error('not found');
  return item;
}

async function mockCreate(payload) {
  await delay(120);
  const now = new Date().toISOString();
  const item = {
    ...payload,
    id: `cr-${Date.now()}`,
    status: 'open',
    createdAt: now,
  };
  mockItems.unshift(item);
  return item;
}

async function mockUpload(file) {
  if (!file) throw new Error('파일이 없습니다.');
  await delay(80);
  const url = URL.createObjectURL(file);
  return { url, name: file.name, size: file.size, id: `poster-${Date.now()}` };
}

export const clubRecruitApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/club-recruit', { params });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mock = await mockList(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/club-recruit/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockGet(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/club-recruit', payload);
      const created = res.data;
      trackPostCreated({
        boardType: 'club_recruit',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'club_recruit',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      return mockCreate(payload);
    }
  },

  async upload(file) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/api/club-recruit/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockUpload(file);
    }
  },

  async approve(id) {
    const res = await api.post(`/api/club-recruit/${id}/approve`);
    return res.data;
  },

  async unapprove(id) {
    const res = await api.post(`/api/club-recruit/${id}/unapprove`);
    return res.data;
  },
};

export default clubRecruitApi;


