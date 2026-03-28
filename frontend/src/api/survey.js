/**
 * @file src/api/survey.js
 * @description Encapsulates backend API contracts, normalization, and fallback behavior.
 * Responsibilities:
 * - Expose a stable API-facing interface for feature code while shielding transport details.
 * Key dependencies:
 * - ./auth
 * - ./normalizers
 * - ../analytics/zaraz
 * Side effects:
 * - Performs HTTP requests to backend endpoints via shared API clients.
 * Role in app flow:
 * - Acts as the data boundary between UI code and backend HTTP endpoints.
 */
import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
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
    const res = await api.get('/api/surveys', { params: normalized });
    return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
  },

  async detail(id) {
    const res = await api.get(`/api/surveys/${id}`);
    return res.data;
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
      trackPostCreateFailed({
        boardType: 'survey',
        userRole: payload?.owner?.role ?? payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async update(id, payload) {
    const res = await api.patch(`/api/surveys/${id}`, payload);
    return res.data;
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
    const res = await api.post(`/api/surveys/${id}/responses`, { answers });
    return res.data;
  },

  async summary(id) {
    const res = await api.get(`/api/surveys/${id}/summary`);
    return res.data;
  },

  async rawResponses(id, params = {}) {
    const res = await api.get(`/api/surveys/${id}/responses`, { params: { ...params, view: 'raw' } });
    return res.data;
  },

  async credits() {
    const res = await api.get('/api/surveys/credits/me');
    return res.data;
  },

  computeStatus,
};

export default surveyApi;


