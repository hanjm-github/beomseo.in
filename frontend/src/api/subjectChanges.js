import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;

const mockItems = [
  {
    id: 'sc-1',
    grade: 1,
    className: '1-3',
    authorNickname: '푸른곰솔',
    approvalStatus: 'approved',
    offeringSubject: '미적분',
    requestingSubject: '확률과 통계',
    type: 'swap',
    status: 'open',
    note: '시간표 충돌로 미통 필요, 3교시 블록 선호',
    commentCount: 4,
    likeCount: 12,
    contactLinks: [{ type: 'kakao', url: '#' }],
    updatedAt: '2026-02-14T10:00:00Z',
    createdAt: '2026-02-13T12:00:00Z',
  },
  {
    id: 'sc-2',
    grade: 2,
    className: '2-1',
    authorNickname: '모란',
    approvalStatus: 'approved',
    offeringSubject: '화학Ⅰ',
    requestingSubject: '생명과학Ⅰ',
    type: 'swap',
    status: 'negotiating',
    note: '실험 시간 조율 가능, 연락 주세요',
    commentCount: 2,
    likeCount: 5,
    contactLinks: [],
    updatedAt: '2026-02-15T08:00:00Z',
    createdAt: '2026-02-12T09:00:00Z',
  },
  {
    id: 'sc-3',
    grade: 3,
    className: '3-5',
    authorNickname: '솔향기',
    approvalStatus: 'approved',
    offeringSubject: '지구과학Ⅱ',
    requestingSubject: '물리Ⅱ',
    type: 'swap',
    status: 'open',
    note: '자이스토리 풀고 있습니다. 교재 유지 희망',
    commentCount: 1,
    likeCount: 7,
    contactLinks: [{ type: 'email', url: 'mailto:sol@example.com' }],
    updatedAt: '2026-02-15T02:00:00Z',
    createdAt: '2026-02-11T07:00:00Z',
  },
  {
    id: 'sc-4',
    grade: 2,
    className: '2-4',
    authorNickname: '별헤는밤',
    approvalStatus: 'approved',
    offeringSubject: '경제',
    requestingSubject: '정치와 법',
    type: 'give',
    status: 'matched',
    note: '이미 매칭 완료, 혹시 변동 시 연락',
    commentCount: 6,
    likeCount: 9,
    contactLinks: [{ type: 'kakao', url: '#' }],
    updatedAt: '2026-02-10T02:00:00Z',
    createdAt: '2026-02-10T02:00:00Z',
  },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const text = (v) => (v || '').toLowerCase();

function filterItems(items, params) {
  let data = [...items];
  const {
    grade,
    q,
    hideClosed,
    subjectTag,
  } = params;

  if (grade === 1 || grade === 2 || grade === 3) {
    data = data.filter((i) => i.grade === Number(grade));
  }

  if (subjectTag && subjectTag !== 'all') {
    data = data.filter(
      (i) => text(i.offeringSubject).includes(text(subjectTag)) || text(i.requestingSubject).includes(text(subjectTag))
    );
  }

  if (hideClosed) {
    data = data.filter((i) => i.status !== 'matched');
  }

  if (q) {
    const qq = text(q);
    data = data.filter(
      (i) =>
        text(i.offeringSubject).includes(qq) ||
        text(i.requestingSubject).includes(qq) ||
        text(i.note).includes(qq) ||
        text(i.authorNickname).includes(qq)
    );
  }

  // onlyMine is ignored in mock but kept for API compatibility
  // always sort by 최신 업데이트 순
  data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return data;
}

async function mockList(params = {}) {
  await delay(120);
  const pageSize = params.pageSize || PAGE_SIZE_DEFAULT;
  const page = params.page || 1;
  const filtered = filterItems(mockItems, params);
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
  await delay(100);
  const now = new Date().toISOString();
  const item = {
    id: `sc-${Date.now()}`,
    grade: payload.grade || 1,
    className: payload.className || '',
    authorNickname: payload.authorNickname || '익명',
    offeringSubject: payload.offeringSubject,
    requestingSubject: payload.requestingSubject,
    type: payload.type || 'swap',
    status: 'open',
    note: payload.note || '',
    commentCount: 0,
    likeCount: 0,
    contactLinks: payload.contactLinks || [],
    createdAt: now,
    updatedAt: now,
  };
  mockItems.unshift(item);
  return item;
}

export const subjectChangesApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/subject-changes', { params });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      // Only fallback when backend is unreachable in local dev.
      if (!err.response) {
        const mock = await mockList(params);
        return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
      }
      throw err;
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/subject-changes/${id}`);
      return res.data;
    } catch (err) {
      if (!err.response) {
        return mockGet(id);
      }
      throw err;
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/subject-changes', payload);
      const created = res.data;
      trackPostCreated({
        boardType: 'subject_change',
        userRole: created?.author?.role ?? created?.owner?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      if (!err.response) {
        return mockCreate(payload);
      }
      trackPostCreateFailed({
        boardType: 'subject_change',
        userRole: payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async approve(id) {
    const res = await api.post(`/api/subject-changes/${id}/approve`);
    return res.data;
  },

  async unapprove(id) {
    const res = await api.post(`/api/subject-changes/${id}/unapprove`);
    return res.data;
  },

  async listComments(id, params = {}) {
    const res = await api.get(`/api/subject-changes/${id}/comments`, { params });
    return normalizePaginatedResponse(res.data, Number(params.pageSize) || 100);
  },

  async createComment(id, body) {
    const res = await api.post(`/api/subject-changes/${id}/comments`, { body });
    return res.data;
  },

  async deleteComment(id, commentId) {
    const res = await api.delete(`/api/subject-changes/${id}/comments/${commentId}`);
    return res.data;
  },

  async changeStatus(id, status) {
    const res = await api.post(`/api/subject-changes/${id}/status`, { status });
    return res.data;
  },
};

export default subjectChangesApi;

