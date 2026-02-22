/**
 * Notices API with optional dev-only mock fallback.
 */
import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import {
  UPLOAD_MAX_ATTACHMENTS,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
} from '../config/env';

const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const loadNoticesMockApi = ENABLE_API_MOCKS
  ? (() => {
      let noticesMockApiPromise;
      return () => {
        if (!noticesMockApiPromise) {
          noticesMockApiPromise = import('./mocks/notices.mock').then(
            (module) => module.noticesMockApi
          );
        }
        return noticesMockApiPromise;
      };
    })()
  : null;

export const noticesApi = {
  async list(params) {
    try {
      const response = await api.get('/api/notices', { params });
      const normalized = normalizePaginatedResponse(response.data, 10);
      return {
        ...normalized,
        countdownEvent: normalized.countdownEvent ?? null,
        fromMock: false,
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      const mock = await mockApi.list(params);
      const normalizedMock = normalizePaginatedResponse(mock, 10);
      return {
        ...normalizedMock,
        countdownEvent: normalizedMock.countdownEvent ?? null,
        fromMock: true,
      };
    }
  },

  async get(id) {
    try {
      const response = await api.get(`/api/notices/${id}`);
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.get(id);
    }
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
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'notice',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadNoticesMockApi();
      return mockApi.create(payload);
    }
  },

  async update(id, payload) {
    try {
      const response = await api.put(`/api/notices/${id}`, payload);
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.update(id, payload);
    }
  },

  async remove(id) {
    try {
      const response = await api.delete(`/api/notices/${id}`);
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.remove(id);
    }
  },

  async react(id, type) {
    try {
      const response = await api.post(`/api/notices/${id}/reactions`, { type });
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.react(id, type);
    }
  },

  async listComments(id, params = {}) {
    try {
      const response = await api.get(`/api/notices/${id}/comments`, { params });
      return normalizePaginatedResponse(response.data, 20);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      const mock = await mockApi.listComments(id, params);
      return normalizePaginatedResponse(mock, 20);
    }
  },

  async createComment(id, body) {
    try {
      const response = await api.post(`/api/notices/${id}/comments`, { body });
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.createComment(id, body);
    }
  },

  async deleteComment(noticeId, commentId) {
    try {
      const response = await api.delete(`/api/notices/${noticeId}/comments/${commentId}`);
      return response.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.deleteComment(noticeId, commentId);
    }
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/notices/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(response.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadNoticesMockApi();
      return mockApi.upload(file);
    }
  },

  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default noticesApi;
