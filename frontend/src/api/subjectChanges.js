/**
 * @file src/api/subjectChanges.js
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

const PAGE_SIZE_DEFAULT = 12;

export const subjectChangesApi = {
  async list(params = {}) {
    const serverParams = { ...params, view: 'list' };
    const res = await api.get('/api/subject-changes', { params: serverParams });
    return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
  },

  async get(id) {
    const res = await api.get(`/api/subject-changes/${id}`);
    return res.data;
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


