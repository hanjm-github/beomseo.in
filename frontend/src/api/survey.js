/**
 * Survey exchange API with optional dev-only mock fallback.
 */
import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

export const BASE_RESPONSE_QUOTA = 0;
export const SURVEY_APPROVAL_GRANT = 30;
const PAGE_SIZE_DEFAULT = 12;

const computeStatus = (survey) => {
  if (!survey) return 'closed';
  const approval =
    survey.approvalStatus ??
    (survey.status === 'approved' || survey.status === 'pending' ? survey.status : null);
  if (approval && approval !== 'approved') return 'closed';
  const expired = survey.expiresAt && new Date(survey.expiresAt) < new Date();
  const quotaMet = (survey.responsesReceived || 0) >= (survey.responseQuota || BASE_RESPONSE_QUOTA);
  if (expired || quotaMet) return 'closed';
  return 'open';
};

const loadSurveyMockApi = ENABLE_API_MOCKS
  ? (() => {
      let surveyMockApiPromise;
      return () => {
        if (!surveyMockApiPromise) {
          surveyMockApiPromise = import('./mocks/survey.mock').then((module) => module.surveyMockApi);
        }
        return surveyMockApiPromise;
      };
    })()
  : null;

export const surveyApi = {
  async list(params = {}) {
    const normalized = {
      sort: params.sort,
      q: params.q,
      status: params.status,
      mine: params.onlyMine ? '1' : undefined,
      hide: params.hideAnswered ? '1' : undefined,
      page: params.page,
      pageSize: params.pageSize,
      view: 'list',
    };
    try {
      const res = await api.get('/api/surveys', { params: normalized });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/surveys/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.detail(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/surveys', payload);
      const created = res.data;
      trackPostCreated({
        boardType: 'survey',
        userRole: created?.owner?.role ?? created?.author?.role ?? payload?.owner?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'survey',
          userRole: payload?.owner?.role ?? payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadSurveyMockApi();
      return mockApi.create(payload);
    }
  },

  async update(id, payload) {
    try {
      const res = await api.patch(`/api/surveys/${id}`, payload);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.update(id, payload);
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
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.submitResponse(id, answers);
    }
  },

  async summary(id) {
    try {
      const res = await api.get(`/api/surveys/${id}/summary`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.summary(id);
    }
  },

  async rawResponses(id, params = {}) {
    try {
      const res = await api.get(`/api/surveys/${id}/responses`, { params: { ...params, view: 'raw' } });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.rawResponses(id);
    }
  },

  async credits() {
    try {
      const res = await api.get('/api/surveys/credits/me');
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSurveyMockApi();
      return mockApi.credits();
    }
  },

  computeStatus,
};

export default surveyApi;
