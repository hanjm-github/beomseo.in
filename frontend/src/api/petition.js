/**
 * @file src/api/petition.js
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

export const petitionApi = {
  async list(params = {}) {
    const serverParams = { ...params, view: 'list' };
    const res = await api.get('/api/community/petitions', { params: serverParams });
    return normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
  },

  async detail(id) {
    const res = await api.get(`/api/community/petitions/${id}`);
    return res.data;
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
      trackPostCreateFailed({
        boardType: 'petition',
        userRole: payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async vote(id, action = 'up') {
    const res = await api.post(`/api/community/petitions/${id}/vote`, { action });
    return res.data;
  },

  async answer(id, payload) {
    const res = await api.post(`/api/community/petitions/${id}/answer`, payload);
    return res.data;
  },

  async approve(id) {
    const res = await api.post(`/api/community/petitions/${id}/approve`);
    return res.data;
  },

  async unapprove(id) {
    const res = await api.post(`/api/community/petitions/${id}/reject`);
    return res.data;
  },

  deriveStatus,
  CATEGORY_OPTIONS,
};

export default petitionApi;


