import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse, toAbsoluteApiUrl } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';

const PAGE_SIZE_DEFAULT = 12;

function normalizeRecruitItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    posterUrl: toAbsoluteApiUrl(item.posterUrl || ''),
  };
}

const loadClubRecruitMockApi = ENABLE_API_MOCKS
  ? (() => {
      let clubRecruitMockApiPromise;
      return () => {
        if (!clubRecruitMockApiPromise) {
          clubRecruitMockApiPromise = import('./mocks/clubRecruit.mock').then(
            (module) => module.clubRecruitMockApi
          );
        }
        return clubRecruitMockApiPromise;
      };
    })()
  : null;

export const clubRecruitApi = {
  async list(params = {}) {
    try {
      const res = await api.get('/api/club-recruit', { params });
      const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
      return {
        ...normalized,
        items: (normalized.items || []).map(normalizeRecruitItem),
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadClubRecruitMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async get(id) {
    try {
      const res = await api.get(`/api/club-recruit/${id}`);
      return normalizeRecruitItem(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadClubRecruitMockApi();
      return mockApi.get(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/club-recruit', payload);
      const created = normalizeRecruitItem(res.data);
      trackPostCreated({
        boardType: 'club_recruit',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'club_recruit',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadClubRecruitMockApi();
      return mockApi.create(payload);
    }
  },

  async upload(file) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/api/club-recruit/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadClubRecruitMockApi();
      return mockApi.upload(file);
    }
  },

  async approve(id) {
    const res = await api.post(`/api/club-recruit/${id}/approve`);
    return normalizeRecruitItem(res.data);
  },

  async unapprove(id) {
    const res = await api.post(`/api/club-recruit/${id}/unapprove`);
    return normalizeRecruitItem(res.data);
  },
};

export default clubRecruitApi;
