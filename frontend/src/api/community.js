/**
 * Community (free/anonymous) board API with optional dev-only mock fallback.
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

const PAGE_SIZE_DEFAULT = 20;
const MAX_ATTACHMENTS = UPLOAD_MAX_ATTACHMENTS;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const CATEGORIES = ['chat', 'info', 'qna'];

const categoryLabel = {
  all: '전체',
  chat: '잡담',
  info: '정보',
  qna: 'QnA',
};

const loadCommunityMockApi = ENABLE_API_MOCKS
  ? (() => {
      let communityMockApiPromise;
      return () => {
        if (!communityMockApiPromise) {
          communityMockApiPromise = import('./mocks/community.mock').then(
            (module) => module.communityMockApi
          );
        }
        return communityMockApiPromise;
      };
    })()
  : null;

export const communityApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/community/free', { params });
      return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/community/free/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.get(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/free', payload);
      const created = res.data;
      trackPostCreated({
        boardType: 'free_board',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'free_board',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadCommunityMockApi();
      return mockApi.create(payload);
    }
  },

  async update(id, payload) {
    try {
      const res = await api.put(`/api/community/free/${id}`, payload);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.update(id, payload);
    }
  },

  async approve(id) {
    const res = await api.post(`/api/community/free/${id}/approve`);
    return res.data;
  },

  async unapprove(id) {
    const res = await api.post(`/api/community/free/${id}/unapprove`);
    return res.data;
  },

  async remove(id) {
    try {
      const res = await api.delete(`/api/community/free/${id}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.remove(id);
    }
  },

  async react(id, type) {
    try {
      const res = await api.post(`/api/community/free/${id}/reactions`, { type });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.react(id, type);
    }
  },

  async toggleBookmark(id) {
    try {
      const res = await api.post(`/api/community/free/${id}/bookmark`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.toggleBookmark(id);
    }
  },

  async listComments(id, params = {}) {
    try {
      const res = await api.get(`/api/community/free/${id}/comments`, { params });
      return normalizePaginatedResponse(res.data, 50);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      const mock = await mockApi.listComments(id, params);
      return normalizePaginatedResponse(mock, 50);
    }
  },

  async createComment(id, body) {
    try {
      const res = await api.post(`/api/community/free/${id}/comments`, { body });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.createComment(id, body);
    }
  },

  async deleteComment(postId, commentId) {
    try {
      const res = await api.delete(`/api/community/free/${postId}/comments/${commentId}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.deleteComment(postId, commentId);
    }
  },

  async upload(file) {
    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/community/free/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadCommunityMockApi();
      return mockApi.upload(file);
    }
  },

  categoryLabel,
  CATEGORIES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default communityApi;
