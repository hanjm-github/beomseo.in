/**
 * @file src/api/notices.js
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
import { normalizePaginatedResponse, normalizeUploadResponse } from './normalizers';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../config/env';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

export const noticesApi = {
  async getBudgetSettings() {
    const response = await api.get('/api/notices/budget/settings');
    return response.data;
  },

  async list(params) {
    const serverParams = { ...(params || {}), view: 'list' };
    const response = await api.get('/api/notices', { params: serverParams });
    const normalized = normalizePaginatedResponse(response.data, 10);
    return {
      ...normalized,
      countdownEvent: normalized.countdownEvent ?? null,
    };
  },

  async get(id) {
    const response = await api.get(`/api/notices/${id}`);
    return response.data;
  },

  async create(payload) {
    try {
      const response = await api.post('/api/notices', payload);
      const created = response.data;
      trackPostCreated({
        boardType: 'notice',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      trackPostCreateFailed({
        boardType: 'notice',
        userRole: payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async update(id, payload) {
    const response = await api.put(`/api/notices/${id}`, payload);
    return response.data;
  },

  async remove(id) {
    const response = await api.delete(`/api/notices/${id}`);
    return response.data;
  },

  async react(id, type) {
    const response = await api.post(`/api/notices/${id}/reactions`, { type });
    return response.data;
  },

  async listComments(id, params = {}) {
    const response = await api.get(`/api/notices/${id}/comments`, { params });
    return normalizePaginatedResponse(response.data, 20);
  },

  async createComment(id, body) {
    const response = await api.post(`/api/notices/${id}/comments`, { body });
    return response.data;
  },

  async deleteComment(noticeId, commentId) {
    const response = await api.delete(`/api/notices/${noticeId}/comments/${commentId}`);
    return response.data;
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/notices/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeUploadResponse(response.data);
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default noticesApi;


