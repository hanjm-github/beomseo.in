/**
 * Survey exchange API with mock fallback and Korean-localized toolbar helpers.
 */
import api from './auth';
import { normalizePaginatedResponse } from './normalizers';

export const BASE_RESPONSE_QUOTA = 0;
export const SURVEY_APPROVAL_GRANT = 30;
const PAGE_SIZE_DEFAULT = 12;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const summarize = (text = '') => {
  const clean = text.replace(/<[^>]+>/g, '').trim();
  return clean.length > 150 ? `${clean.slice(0, 150)}…` : clean;
};

const computeStatus = (survey) => {
  if (!survey) return 'closed';
  const expired = survey.expiresAt && new Date(survey.expiresAt) < new Date();
  const quotaMet = (survey.responsesReceived || 0) >= (survey.responseQuota || BASE_RESPONSE_QUOTA);
  if (expired || quotaMet) return 'closed';
  return 'open';
};

const mockNow = () => new Date().toISOString();

let mockSurveys = [
  {
    id: 'svy-1',
    title: '점심 만족도 설문',
    description: '오늘 급식 만족도를 1~5점으로 평가해주세요.',
    formJson: [
      {
        id: 'q1',
        element: 'RadioButtons',
        label: '점수 선택',
        required: true,
        field_name: 'score_rating',
        options: [
          { value: '1', text: '1점', key: 'opt_1' },
          { value: '2', text: '2점', key: 'opt_2' },
          { value: '3', text: '3점', key: 'opt_3' },
          { value: '4', text: '4점', key: 'opt_4' },
          { value: '5', text: '5점', key: 'opt_5' },
        ]
      },
      {
        id: 'q2',
        element: 'TextArea',
        label: '개선 의견',
        required: false,
        field_name: 'feedback_text'
      },
    ],
    responsesReceived: 6,
    responseQuota: 12,
    expiresAt: null,
    owner: { id: 'u-1', name: '학생회', role: 'student-council' },
    createdAt: mockNow(),
    updatedAt: mockNow(),
  },
  {
    id: 'svy-2',
    title: '축제 부스 아이디어',
    description: '올해 축제에 보고 싶은 부스를 적어주세요!',
    formJson: [
      {
        id: 'q1',
        element: 'TextInput',
        label: '한 줄 아이디어',
        required: true,
        field_name: 'booth_idea'
      },
      {
        id: 'q2',
        element: 'Checkboxes',
        label: '어디에 참여하고 싶나요?',
        required: false,
        field_name: 'participation_type',
        options: [
          { value: 'game', text: '게임', key: 'opt_game' },
          { value: 'food', text: '푸드', key: 'opt_food' },
          { value: 'experience', text: '체험', key: 'opt_exp' },
          { value: 'photo', text: '포토', key: 'opt_photo' },
        ]
      },
    ],
    responsesReceived: 2,
    responseQuota: 20,
    expiresAt: null,
    owner: { id: 'u-2', name: '3학년 문화부', role: 'student' },
    createdAt: mockNow(),
    updatedAt: mockNow(),
  },
];

let mockCredits = { base: BASE_RESPONSE_QUOTA, earned: 10, used: 2 };

const mockSummary = {
  questions: [
    { id: 'q1', text: '점수 선택', type: 'choice', counts: { 1: 0, 2: 1, 3: 2, 4: 2, 5: 1 } },
    { id: 'q2', text: '개선 의견', type: 'text', samples: ['국 굿', '치킨 더 주세요', '김치는 최고'] },
  ],
  total: 6,
};

async function mockList(params = {}) {
  await delay(80);
  let items = [...mockSurveys].map((s) => ({ ...s, status: computeStatus(s), summary: summarize(s.description) }));

  if (params.q) {
    const keyword = params.q.toLowerCase();
    items = items.filter(
      (s) =>
        s.title.toLowerCase().includes(keyword) ||
        (s.description || '').toLowerCase().includes(keyword)
    );
  }
  if (params.hideAnswered) items = items.filter((s) => !s.isAnsweredByMe);
  if (params.onlyMine) items = items.filter((s) => s.owner?.id === 'me');

  if (params.sort === 'responses-desc') items.sort((a, b) => (b.responsesReceived || 0) - (a.responsesReceived || 0));
  else if (params.sort === 'quota-asc') items.sort((a, b) => (a.responseQuota - a.responsesReceived) - (b.responseQuota - b.responsesReceived));
  else items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const page = Number(params.page || 1);
  const pageSize = Number(params.pageSize || PAGE_SIZE_DEFAULT);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize };
}

async function mockDetail(id) {
  await delay(60);
  const found = mockSurveys.find((s) => s.id === id);
  if (!found) throw new Error('Not found');
  return { ...found, status: computeStatus(found) };
}

async function mockCreate(payload) {
  await delay(100);
  const now = mockNow();
  const item = {
    id: `svy-${Date.now()}`,
    title: payload.title,
    description: payload.description || summarize(payload.description || ''),
    tags: payload.tags || [],
    themeColor: payload.themeColor || '#a78bfa',
    thumbnailUrl: payload.thumbnailUrl,
    formJson: payload.formJson || [],
    responsesReceived: 0,
    responseQuota: BASE_RESPONSE_QUOTA,
    approvalStatus: 'pending',
    status: 'closed',
    expiresAt: payload.expiresAt || null,
    owner: payload.owner || { id: 'me', name: '나', role: 'student' },
    createdAt: now,
    updatedAt: now,
  };
  mockSurveys = [item, ...mockSurveys];
  return item;
}

async function mockUpdate(id, payload) {
  await delay(80);
  mockSurveys = mockSurveys.map((s) => (s.id === id ? { ...s, ...payload, updatedAt: mockNow() } : s));
  return mockDetail(id);
}

async function mockSubmitResponse(id, answers = {}) {
  await delay(60);
  mockSurveys = mockSurveys.map((s) =>
    s.id === id
      ? { ...s, responsesReceived: (s.responsesReceived || 0) + 1, responseQuota: s.responseQuota || SURVEY_APPROVAL_GRANT }
      : s
  );
  mockCredits = { ...mockCredits, earned: mockCredits.earned + 5, available: undefined };
  return { responseId: `resp-${Date.now()}`, creditsEarned: 5, creditAvailable: mockCredits.available || 0, answers };
}

async function mockGetCredits() {
  await delay(40);
  const available = mockCredits.base + mockCredits.earned - (mockCredits.used || 0);
  return { ...mockCredits, available };
}

async function mockGetSummary(id) {
  await delay(50);
  await mockDetail(id);
  return mockSummary;
}

async function mockGetRaw(id) {
  await delay(50);
  await mockDetail(id);
  return {
    total: mockSummary.total,
    rows: Array.from({ length: mockSummary.total }).map((_, idx) => ({
      id: `resp-${idx}`,
      submittedAt: new Date(Date.now() - idx * 3600 * 1000).toISOString(),
      answers: { q1: String((idx % 5) + 1), q2: `의견 ${idx + 1}` },
    })),
  };
}

export const surveyApi = {
  async list(params = {}) {
    const normalized = {
      sort: params.sort,
      q: params.q,
      mine: params.onlyMine ? '1' : undefined,
      hide: params.hideAnswered ? '1' : undefined,
      page: params.page,
      pageSize: params.pageSize,
    };
    try {
      const res = await api.get('/api/surveys', { params: normalized });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch {
      const mock = await mockList(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/surveys/${id}`);
      return res.data;
    } catch {
      return mockDetail(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/surveys', payload);
      return res.data;
    } catch {
      return mockCreate(payload);
    }
  },

  async update(id, payload) {
    try {
      const res = await api.patch(`/api/surveys/${id}`, payload);
      return res.data;
    } catch {
      return mockUpdate(id, payload);
    }
  },

  async approve(id) {
    const res = await api.post(`/api/surveys/${id}/approve`);
    return res.data;
  },

  async unapprove(id) {
    const res = await api.post(`/api/surveys/${id}/unapprove`);
    return res.data;
  },

  async submitResponse(id, answers) {
    try {
      const res = await api.post(`/api/surveys/${id}/responses`, { answers });
      return res.data;
    } catch {
      return mockSubmitResponse(id, answers);
    }
  },

  async summary(id) {
    try {
      const res = await api.get(`/api/surveys/${id}/summary`);
      return res.data;
    } catch {
      return mockGetSummary(id);
    }
  },

  async rawResponses(id, params = {}) {
    try {
      const res = await api.get(`/api/surveys/${id}/responses`, { params: { ...params, view: 'raw' } });
      return res.data;
    } catch {
      return mockGetRaw(id);
    }
  },

  async credits() {
    try {
      const res = await api.get('/api/surveys/credits/me');
      return res.data;
    } catch {
      return mockGetCredits();
    }
  },

  computeStatus,
};

export default surveyApi;

