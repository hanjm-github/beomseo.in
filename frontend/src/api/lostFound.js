import api from './auth';
import { normalizePaginatedResponse, normalizeUploadResponse, toAbsoluteApiUrl } from './normalizers';
import { ENABLE_API_MOCKS, shouldUseMockFallback } from './mockPolicy';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import {
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
  UPLOAD_MAX_IMAGES,
} from '../config/env';

const PAGE_SIZE_DEFAULT = 12;
const MAX_IMAGES = UPLOAD_MAX_IMAGES;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;
const WRITER_ROLES = ['admin', 'student_council', 'council'];

export const LOST_FOUND_STATUS = {
  searching: '주인 찾는 중',
  found: '주인 찾음',
};

export const LOST_FOUND_CATEGORIES = {
  electronics: '전자기기',
  clothing: '의류',
  bag: '가방',
  wallet_card: '지갑·카드',
  stationery: '문구',
  etc: '기타',
};

const asIso = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizeImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .slice(0, MAX_IMAGES)
    .map((image, index) => ({
      id: image?.id || `lf-img-${index + 1}`,
      name: image?.name || `image-${index + 1}.jpg`,
      url: toAbsoluteApiUrl(image?.url),
    }))
    .filter((image) => Boolean(image.url));

const normalizeItem = (item = {}) => ({
  id: String(item.id ?? ''),
  title: String(item.title ?? ''),
  description: String(item.description ?? ''),
  status: item.status === 'found' ? 'found' : 'searching',
  category: Object.prototype.hasOwnProperty.call(LOST_FOUND_CATEGORIES, item.category) ? item.category : 'etc',
  images: normalizeImages(item.images),
  foundAt: asIso(item.foundAt || item.found_at) || new Date().toISOString(),
  foundLocation: String(item.foundLocation || item.found_location || ''),
  storageLocation: String(item.storageLocation || item.storage_location || ''),
  createdAt: asIso(item.createdAt || item.created_at) || new Date().toISOString(),
  updatedAt: asIso(item.updatedAt || item.updated_at) || new Date().toISOString(),
  views: Number(item.views ?? 0),
  commentsCount: Number(item.commentsCount ?? item.comments_count ?? 0),
  approvalStatus: item.approvalStatus ?? item.approval_status,
  author: {
    id: item.author?.id ?? null,
    name: item.author?.name ?? item.author?.nickname ?? '운영진',
    role: item.author?.role ?? 'student_council',
  },
});

const loadLostFoundMockApi = ENABLE_API_MOCKS
  ? (() => {
      let lostFoundMockApiPromise;
      return () => {
        if (!lostFoundMockApiPromise) {
          lostFoundMockApiPromise = import('./mocks/lostFound.mock').then(
            (module) => module.lostFoundMockApi
          );
        }
        return lostFoundMockApiPromise;
      };
    })()
  : null;

export const lostFoundApi = {
  writerRoles: WRITER_ROLES,
  statusLabel: LOST_FOUND_STATUS,
  categoryLabel: LOST_FOUND_CATEGORIES,
  MAX_IMAGES,
  MAX_FILE_SIZE,

  canWrite(user) {
    return WRITER_ROLES.includes(user?.role);
  },

  async list(params = {}) {
    try {
      const res = await api.get('/api/community/lost-found', { params });
      const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
      return {
        ...normalized,
        items: (normalized.items || []).map(normalizeItem),
      };
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      const mock = await mockApi.list(params);
      return normalizePaginatedResponse(mock, PAGE_SIZE_DEFAULT);
    }
  },

  async detail(id) {
    try {
      const res = await api.get(`/api/community/lost-found/${id}`);
      return normalizeItem(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      return mockApi.detail(id);
    }
  },

  async create(payload) {
    try {
      const res = await api.post('/api/community/lost-found', payload);
      const created = normalizeItem(res.data);
      trackPostCreated({
        boardType: 'lost_found',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      const useMockFallback = shouldUseMockFallback(err);
      if (!useMockFallback) {
        trackPostCreateFailed({
          boardType: 'lost_found',
          userRole: payload?.author?.role,
          errorType: err,
        });
        throw err;
      }
      const mockApi = await loadLostFoundMockApi();
      return mockApi.create(payload);
    }
  },

  async updateStatus(id, status) {
    try {
      const res = await api.post(`/api/community/lost-found/${id}/status`, { status });
      return normalizeItem(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      return mockApi.updateStatus(id, status);
    }
  },

  async upload(file) {
    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`이미지는 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/community/lost-found/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return normalizeUploadResponse(res.data);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      return mockApi.upload(file);
    }
  },

  async listComments(id, params = {}) {
    try {
      const res = await api.get(`/api/community/lost-found/${id}/comments`, { params });
      return normalizePaginatedResponse(res.data, 50);
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      const mock = await mockApi.listComments(id, params);
      return normalizePaginatedResponse(mock, 50);
    }
  },

  async createComment(id, body) {
    try {
      const res = await api.post(`/api/community/lost-found/${id}/comments`, { body });
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      return mockApi.createComment(id, body);
    }
  },

  async deleteComment(id, commentId) {
    try {
      const res = await api.delete(`/api/community/lost-found/${id}/comments/${commentId}`);
      return res.data;
    } catch (err) {
      if (!shouldUseMockFallback(err)) throw err;
      const mockApi = await loadLostFoundMockApi();
      return mockApi.deleteComment(id, commentId);
    }
  },
};

export default lostFoundApi;


