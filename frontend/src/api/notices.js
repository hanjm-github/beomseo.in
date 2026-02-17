
/**
 * Notices API with graceful mock fallback.
 * Uses shared axios instance from auth api for authenticated operations.
 */
import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse } from './normalizers';

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
    likes: 12,
    dislikes: 1,
    myReaction: null,
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
    likes: 5,
    dislikes: 0,
    myReaction: null,
    attachments: [],
  },
];

const mockComments = {
  'n-1': [
    {
      id: 'c-1',
      noticeId: 'n-1',
      body: '시험 범위 감사합니다!',
      author: { id: 'u-1', name: '학생1', role: 'student' },
      createdAt: '2026-03-06T08:00:00Z',
      updatedAt: '2026-03-06T08:00:00Z',
    },
  ],
  'n-2': [],
};

const mockMyReactions = {};

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
    countdownEvent: null,
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
    likes: 0,
    dislikes: 0,
    myReaction: null,
    views: payload.views || 0,
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

function resolveReactionState(noticeId) {
  const notice = mockNotices.find((n) => n.id === noticeId);
  if (!notice) throw new Error('Not found');
  const current = mockMyReactions[noticeId] || null;
  return { notice, current };
}

async function mockReact(noticeId, type) {
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

async function mockListComments(noticeId, params) {
  await delay(60);
  const comments = mockComments[noticeId] || [];
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

async function mockCreateComment(noticeId, body) {
  await delay(60);
  const now = new Date().toISOString();
  const comment = {
    id: `c-${Date.now()}`,
    noticeId,
    body,
    author: { id: 'me', name: '나', role: 'student' },
    createdAt: now,
    updatedAt: now,
  };
  mockComments[noticeId] = [comment, ...(mockComments[noticeId] || [])];
  return comment;
}

async function mockDeleteComment(noticeId, commentId) {
  await delay(40);
  mockComments[noticeId] = (mockComments[noticeId] || []).filter((c) => c.id !== commentId);
  return { success: true };
}

export const noticesApi = {
  async list(params) {
    try {
      const response = await api.get('/api/notices', { params });
      const normalized = normalizePaginatedResponse(response.data, 10);
      return {
        ...normalized,
        countdownEvent: normalized.countdownEvent ?? null,
        fromMock: false,
      };
    } catch {
      const mock = await mockList(params);
      const normalizedMock = normalizePaginatedResponse(mock, 10);
      return {
        ...normalizedMock,
        countdownEvent: normalizedMock.countdownEvent ?? null,
        fromMock: true,
      };
    }
  },

  async get(id) {
    try {
      const response = await api.get(`/api/notices/${id}`);
      return response.data;
    } catch {
      return mockGet(id);
    }
  },

  async create(payload) {
    try {
      const response = await api.post('/api/notices', payload);
      return response.data;
    } catch {
      return mockCreate(payload);
    }
  },

  async update(id, payload) {
    try {
      const response = await api.put(`/api/notices/${id}`, payload);
      return response.data;
    } catch {
      return mockUpdate(id, payload);
    }
  },

  async remove(id) {
    try {
      const response = await api.delete(`/api/notices/${id}`);
      return response.data;
    } catch {
      return mockDelete(id);
    }
  },

  async react(id, type) {
    try {
      const response = await api.post(`/api/notices/${id}/reactions`, { type });
      return response.data;
    } catch {
      return mockReact(id, type);
    }
  },

  async listComments(id, params = {}) {
    try {
      const response = await api.get(`/api/notices/${id}/comments`, { params });
      return normalizePaginatedResponse(response.data, 20);
    } catch {
      const mock = await mockListComments(id, params);
      return normalizePaginatedResponse(mock, 20);
    }
  },

  async createComment(id, body) {
    try {
      const response = await api.post(`/api/notices/${id}/comments`, { body });
      return response.data;
    } catch {
      return mockCreateComment(id, body);
    }
  },

  async deleteComment(noticeId, commentId) {
    try {
      const response = await api.delete(`/api/notices/${noticeId}/comments/${commentId}`);
      return response.data;
    } catch {
      return mockDeleteComment(noticeId, commentId);
    }
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('첨부 용량은 10MB 이하만 가능합니다.');
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/notices/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(response.data);
    } catch {
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

