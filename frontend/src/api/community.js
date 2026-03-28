/**
 * @file src/api/community.js
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

export const communityApi = {
  async list(params = {}) {
    const serverParams = { ...params, view: 'list' };
    const res = await api.get('/api/community/free', { params: serverParams });
    return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
  },

  async get(id) {
    const res = await api.get(`/api/community/free/${id}`);
    return res.data;
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
      trackPostCreateFailed({
        boardType: 'free_board',
        userRole: payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async update(id, payload) {
    const res = await api.put(`/api/community/free/${id}`, payload);
    return res.data;
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
    const res = await api.delete(`/api/community/free/${id}`);
    return res.data;
  },

  async react(id, type) {
    const res = await api.post(`/api/community/free/${id}/reactions`, { type });
    return res.data;
  },

  async toggleBookmark(id) {
    const res = await api.post(`/api/community/free/${id}/bookmark`);
    return res.data;
  },

  async listComments(id, params = {}) {
    const res = await api.get(`/api/community/free/${id}/comments`, { params });
    return normalizePaginatedResponse(res.data, 50);
  },

  async createComment(id, body) {
    const res = await api.post(`/api/community/free/${id}/comments`, { body });
    return res.data;
  },

  async deleteComment(postId, commentId) {
    const res = await api.delete(`/api/community/free/${postId}/comments/${commentId}`);
    return res.data;
  },

  async upload(file) {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`첨부 용량은 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 가능합니다.`);
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/api/community/free/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeUploadResponse(res.data);
  },

  categoryLabel,
  CATEGORIES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
};

export default communityApi;


