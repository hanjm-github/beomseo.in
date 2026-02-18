/**
 * Petition board API with graceful mock fallback.
 * Mirrors existing board APIs while adding vote-threshold logic.
 */
import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;
export const THRESHOLD_DEFAULT = 50;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CATEGORY_OPTIONS = ['시설', '급식', '학사', '행사', '기타'];

const deriveStatus = (item) => {
  if (item?.answer) return 'answered';
  if ((item?.votes || 0) >= (item?.threshold || THRESHOLD_DEFAULT)) return 'waiting-answer';
  return 'needs-support';
};

const summarize = (text = '') => {
  const clean = text.replace(/<[^>]+>/g, '');
  return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
};

let mockPetitions = [
  {
    id: 'pet-1',
    title: '급식실 냉난방 온도 조절 개선 요청',
    summary: '점심시간에 너무 더워서 식사하기 힘들어요. 센서 재조정과 선풍기 추가 요청합니다.',
    category: '급식',
    votes: 32,
    threshold: THRESHOLD_DEFAULT,
    createdAt: '2026-03-04T01:00:00Z',
    author: { nickname: '별빛', role: 'student' },
  },
  {
    id: 'pet-2',
    title: '3학년 자습실 콘센트 추가 설치',
    summary: '노트북 사용 인원이 늘어났습니다. 벽면 4구 콘센트 3세트 추가 설치 부탁드립니다.',
    category: '시설',
    votes: 54,
    threshold: THRESHOLD_DEFAULT,
    createdAt: '2026-03-05T03:30:00Z',
    author: { nickname: '공대꿈나무', role: 'student' },
    answer: {
      responder: '학생회장',
      role: 'student-council',
      content: '행정실과 협의하여 3월 둘째 주에 설치 완료 예정입니다. 진행 상황을 공지로 안내하겠습니다.',
      updatedAt: '2026-03-06T06:00:00Z',
    },
  },
  {
    id: 'pet-3',
    title: '체육대회 종목에 배드민턴 추가',
    summary: '비인기 종목 다양화를 위해 배드민턴 단식/복식 예선을 도입하면 좋겠습니다.',
    category: '행사',
    votes: 12,
    threshold: THRESHOLD_DEFAULT,
    createdAt: '2026-03-06T09:10:00Z',
    author: { nickname: '체육부', role: 'student-council' },
  },
];

async function mockList(params = {}) {
  await delay(100);
  const { status, category, q, sort = 'recent', page = 1, pageSize = PAGE_SIZE_DEFAULT } = params;
  let data = mockPetitions.map((p) => ({ ...p, status: deriveStatus(p) }));

  if (status && status !== 'all') data = data.filter((p) => p.status === status);
  if (category && CATEGORY_OPTIONS.includes(category)) data = data.filter((p) => p.category === category);
  if (q) {
    const keyword = q.toLowerCase();
    data = data.filter(
      (p) =>
        p.title.toLowerCase().includes(keyword) ||
        p.summary.toLowerCase().includes(keyword) ||
        (p.body || '').toLowerCase().includes(keyword)
    );
  }

  if (sort === 'votes') {
    data.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  } else {
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const start = (page - 1) * pageSize;
  return {
    items: data.slice(start, start + pageSize),
    total: data.length,
    page,
    pageSize,
  };
}

async function mockDetail(id) {
  await delay(80);
  const found = mockPetitions.find((p) => p.id === id);
  if (!found) throw new Error('Not found');
  return { ...found, status: deriveStatus(found) };
}

async function mockCreate(payload) {
  await delay(120);
  const now = new Date().toISOString();
  const item = {
    id: `pet-${Date.now()}`,
    title: payload.title,
    summary: payload.summary || summarize(payload.body),
    body: payload.body || '',
    category: payload.category || '기타',
    votes: 0,
    threshold: payload.threshold || THRESHOLD_DEFAULT,
    createdAt: now,
    author: payload.author || { nickname: '익명', role: 'student' },
    status: 'needs-support',
    isVotedByMe: false,
  };
  mockPetitions = [item, ...mockPetitions];
  return { ...item, status: deriveStatus(item) };
}

async function mockVote(id, action) {
  await delay(60);
  mockPetitions = mockPetitions.map((p) => {
    if (p.id !== id) return p;
    const next = { ...p };
    const already = !!next.isVotedByMe;
    if (action === 'up' && !already) {
      next.votes = (next.votes || 0) + 1;
      next.isVotedByMe = true;
    } else if (action === 'cancel' && already) {
      next.votes = Math.max(0, (next.votes || 0) - 1);
      next.isVotedByMe = false;
    }
    next.status = deriveStatus(next);
    return next;
  });
  const updated = mockPetitions.find((p) => p.id === id);
  return { votes: updated.votes, isVotedByMe: updated.isVotedByMe, status: updated.status };
}

async function mockAnswer(id, payload) {
  await delay(80);
  mockPetitions = mockPetitions.map((p) =>
    p.id === id
      ? {
          ...p,
          answer: {
            responder: payload.responder || '학생회장',
            role: payload.role || 'student-council',
            content: payload.content || '',
            updatedAt: new Date().toISOString(),
          },
        }
      : p
  );
  return mockDetail(id);
}

export const petitionApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/community/petitions', { params });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mock = await mockList(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/community/petitions/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockDetail(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/petitions', payload);
      const created = res.data;
      trackPostCreated({
        boardType: 'petition',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'petition',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      return mockCreate(payload);
    }
  },

  async vote(id, action = 'up') {
    try {
      const res = await api.post(`/api/community/petitions/${id}/vote`, { action });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockVote(id, action);
    }
  },

  async answer(id, payload) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/answer`, payload);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      return mockAnswer(id, payload);
    }
  },

  async approve(id) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/approve`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      // mock: mark as approved
      const found = mockPetitions.find((p) => p.id === id);
      if (found) {
        found.status = 'approved';
      }
      return mockDetail(id);
    }
  },

  async unapprove(id) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/reject`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const found = mockPetitions.find((p) => p.id === id);
      if (found) {
        found.status = 'pending';
      }
      return mockDetail(id);
    }
  },

  deriveStatus,
  CATEGORY_OPTIONS,
};

export default petitionApi;

