
/**
 * Notices API with graceful mock fallback.
 * Uses shared axios instance from auth api for authenticated operations.
 */
import api from './auth';

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Simple in-memory mock dataset so the UI works without backend wired.
let mockNotices = [
  {
    id: 'n-1',
    category: 'school',
    title: '중간고사 일정 및 범위 안내',
    summary: '2학년 전체 중간고사 일정과 과목별 범위를 공지합니다.',
    body: '<p>중간고사는 4월 21일(화)부터 24일(금)까지 진행됩니다. 과목별 세부 범위는 첨부 파일을 참고하세요.</p>',
    pinned: true,
    important: true,
    examRelated: true,
    tags: ['시험', '일정'],
    author: { name: '교무부', role: 'admin' },
    createdAt: '2026-03-02T09:00:00Z',
    updatedAt: '2026-03-02T09:00:00Z',
    views: 129,
    attachments: [
      {
        id: 'f-1',
        name: 'midterm-scope.pdf',
        size: 235000,
        url: '#',
        mime: 'application/pdf',
        kind: 'file',
      },
    ],
  },
  {
    id: 'n-2',
    category: 'council',
    title: '학생회 2분기 활동 계획 공유',
    summary: '축제 준비, 환경 캠페인, 동아리 연합회 회의 일정 공유',
    body: '<p>4월에는 교내 환경 캠페인을 진행하며, 5월에는 축제 준비에 돌입합니다.</p>',
    pinned: false,
    important: true,
    examRelated: false,
    tags: ['학생회', '행사'],
    author: { name: '학생회장', role: 'council' },
    createdAt: '2026-03-05T12:00:00Z',
    updatedAt: '2026-03-05T12:00:00Z',
    views: 88,
    attachments: [],
  },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function summarize(html) {
  const text = html.replace(/<[^>]+>/g, '');
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function applyListFilters(data, params) {
  const { category, query, pinned, important, exam, sort } = params;
  let result = [...data];
  if (category) result = result.filter((n) => n.category === category);
  if (pinned) result = result.filter((n) => n.pinned);
  if (important) result = result.filter((n) => n.important);
  if (exam) result = result.filter((n) => n.examRelated);
  if (query) {
    const q = query.toLowerCase();
    result = result.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.summary || '').toLowerCase().includes(q) ||
        (n.body || '').toLowerCase().includes(q)
    );
  }

  switch (sort) {
    case 'views':
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        return (b.views || 0) - (a.views || 0) || new Date(b.createdAt) - new Date(a.createdAt);
      });
      break;
    case 'important':
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        if (a.important !== b.important) return Number(b.important) - Number(a.important);
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      break;
    default:
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned - a.pinned;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  return result;
}

async function mockList(params) {
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
  };
}

async function mockGet(id) {
  await delay(80);
  const hit = mockNotices.find((n) => n.id === id);
  if (!hit) throw new Error('Not found');
  return hit;
}

async function mockCreate(payload) {
  await delay(120);
  const id = `n-${Date.now()}`;
  const now = new Date().toISOString();
  const withMeta = {
    ...payload,
    id,
    createdAt: now,
    updatedAt: now,
    summary: payload.summary || summarize(payload.body || ''),
  };
  mockNotices = [withMeta, ...mockNotices];
  return withMeta;
}

async function mockUpdate(id, payload) {
  await delay(120);
  mockNotices = mockNotices.map((n) =>
    n.id === id
      ? {
          ...n,
          ...payload,
          summary: payload.summary || summarize(payload.body || n.body || ''),
          updatedAt: new Date().toISOString(),
        }
      : n
  );
  return mockNotices.find((n) => n.id === id);
}

async function mockDelete(id) {
  await delay(80);
  mockNotices = mockNotices.filter((n) => n.id !== id);
  return { success: true };
}

export const noticesApi = {
  async list(params) {
    try {
      const response = await api.get('/api/notices', { params });
      return response.data;
    } catch (error) {
      return mockList(params);
    }
  },

  async get(id) {
    try {
      const response = await api.get(`/api/notices/${id}`);
      return response.data;
    } catch (error) {
      return mockGet(id);
    }
  },

  async create(payload) {
    try {
      const response = await api.post('/api/notices', payload);
      return response.data;
    } catch (error) {
      return mockCreate(payload);
    }
  },

  async update(id, payload) {
    try {
      const response = await api.put(`/api/notices/${id}`, payload);
      return response.data;
    } catch (error) {
      return mockUpdate(id, payload);
    }
  },

  async remove(id) {
    try {
      const response = await api.delete(`/api/notices/${id}`);
      return response.data;
    } catch (error) {
      return mockDelete(id);
    }
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('첨부 용량은 10MB 이하만 가능합니다.');
    }
    const ensureAbsolute = (url) => {
      if (!url) return url;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      const base = api.defaults.baseURL?.replace(/\/$/, '') || '';
      const prefix = url.startsWith('/') ? '' : '/';
      return `${base}${prefix}${url}`;
    };
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/notices/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data;
      return { ...data, url: ensureAbsolute(data.url) };
    } catch (error) {
      // Mock upload
      await delay(120);
      const url = URL.createObjectURL(file);
      return {
        id: `a-${Date.now()}`,
        name: file.name,
        size: file.size,
        url,
        mime: file.type || 'application/octet-stream',
        kind: file.type?.startsWith('image/') ? 'image' : 'file',
      };
    }
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default noticesApi;
