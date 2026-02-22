import api from './auth';
import { normalizePaginatedResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;

const loadSubjectChangesMockApi = ENABLE_API_MOCKS
  ? (() => {
      let subjectChangesMockApiPromise;
      return () => {
        if (!subjectChangesMockApiPromise) {
          subjectChangesMockApiPromise = import('./mocks/subjectChanges.mock').then(
            (module) => module.subjectChangesMockApi
          );
        }
        return subjectChangesMockApiPromise;
      };
    })()
  : null;

export const subjectChangesApi = {
  async list(params = {}) {
    const serverParams = { ...params, view: 'list' };
    try {
      const res = await api.get('/api/subject-changes', { params: serverParams });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSubjectChangesMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/subject-changes/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadSubjectChangesMockApi();
      return mockApi.get(id);
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
      if (!shouldUseMockFallback(err)) {
        trackPostCreateFailed({
          boardType: 'subject_change',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadSubjectChangesMockApi();
      return mockApi.create(payload);
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
