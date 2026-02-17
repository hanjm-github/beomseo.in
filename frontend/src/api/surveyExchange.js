import api from './auth';

const mockSurveys = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function enrich(item, me = 'me') {
  const responseLimit = (item.baseQuota || 10) + (item.bonusQuota || 0);
  const responsesCount = item.responsesCount || 0;
  return {
    ...item,
    responseLimit,
    remainingSlots: Math.max(0, responseLimit - responsesCount),
    mine: item.author?.id === me,
  };
}

async function mockList(params = {}) {
  await delay(80);
  const mine = params.mine;
  const me = 'me';
  const data = mine ? mockSurveys.filter((s) => s.author?.id === me) : mockSurveys;
  return {
    items: data.map((it) => enrich(it, me)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    total: data.length,
    page: 1,
    page_size: 50,
  };
}

async function mockCreate(payload) {
  await delay(100);
  const now = new Date().toISOString();
  const item = {
    id: Date.now(),
    title: payload.title,
    description: payload.description,
    formSchema: payload.formSchema,
    baseQuota: 10,
    bonusQuota: 0,
    responsesCount: 0,
    author: { id: 'me', nickname: '나', role: 'student' },
    createdAt: now,
    updatedAt: now,
  };
  mockSurveys.unshift(item);
  return enrich(item);
}

async function mockGet(id) {
  await delay(80);
  const survey = mockSurveys.find((it) => String(it.id) === String(id));
  if (!survey) throw new Error('not found');
  return enrich(survey);
}

async function mockRespond(id) {
  await delay(80);
  const idx = mockSurveys.findIndex((it) => String(it.id) === String(id));
  if (idx < 0) throw new Error('not found');
  mockSurveys[idx].responsesCount += 1;
  return { ok: true };
}

export const surveyExchangeApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/community/surveys', { params });
      return res.data;
    } catch (err) {
      if (!err.response) return mockList(params);
      throw err;
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/surveys', payload);
      return res.data;
    } catch (err) {
      if (!err.response) return mockCreate(payload);
      throw err;
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/community/surveys/${id}`);
      return res.data;
    } catch (err) {
      if (!err.response) return mockGet(id);
      throw err;
    }
  },

  async submitResponse(id, answers) {
    try {
      const res = await api.post(`/api/community/surveys/${id}/responses`, { answers });
      return res.data;
    } catch (err) {
      if (!err.response) return mockRespond(id);
      throw err;
    }
  },
};

export default surveyExchangeApi;
