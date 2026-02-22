/**
 * Petition board API with optional dev-only mock fallback.
 */
import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import { PETITION_THRESHOLD_DEFAULT } from '../config/env';

const PAGE_SIZE_DEFAULT = 12;
export const THRESHOLD_DEFAULT = PETITION_THRESHOLD_DEFAULT;

const CATEGORY_OPTIONS = [
  '기타',
  '회장단',
  '3학년부',
  '2학년부',
  '정보기술부',
  '방송부',
  '학예부',
  '체육부',
  '진로부',
  '홍보부',
  '기후환경부',
  '학생지원부',
  '생활안전부',
  '융합인재부',
];

const deriveStatus = (item) => {
  if (item?.answer) return 'answered';
  if ((item?.votes || 0) >= (item?.threshold || THRESHOLD_DEFAULT)) return 'waiting-answer';
  return 'needs-support';
};

const loadPetitionMockApi = ENABLE_API_MOCKS
  ? (() => {
      let petitionMockApiPromise;
      return () => {
        if (!petitionMockApiPromise) {
          petitionMockApiPromise = import('./mocks/petition.mock').then((module) => module.petitionMockApi);
        }
        return petitionMockApiPromise;
      };
    })()
  : null;

export const petitionApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/community/petitions', { params });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/community/petitions/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      return mockApi.detail(id);
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
      const mockApi = await loadPetitionMockApi();
      return mockApi.create(payload);
    }
  },

  async vote(id, action = 'up') {
    try {
      const res = await api.post(`/api/community/petitions/${id}/vote`, { action });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      return mockApi.vote(id, action);
    }
  },

  async answer(id, payload) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/answer`, payload);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      return mockApi.answer(id, payload);
    }
  },

  async approve(id) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/approve`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      return mockApi.approve(id);
    }
  },

  async unapprove(id) {
    try {
      const res = await api.post(`/api/community/petitions/${id}/reject`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadPetitionMockApi();
      return mockApi.unapprove(id);
    }
  },

  deriveStatus,
  CATEGORY_OPTIONS,
};

export default petitionApi;
