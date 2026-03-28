/**
 * @file src/api/gomsolMarket.js
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
import {
  normalizePaginatedResponse,
  normalizeUploadResponse,
  toAbsoluteApiUrl,
} from './normalizers';
import { trackPostCreated, trackPostCreateFailed } from '../analytics/zaraz';
import {
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILE_SIZE_MB,
  UPLOAD_MAX_IMAGES,
} from '../config/env';

const PAGE_SIZE_DEFAULT = 12;
const MAX_IMAGES = UPLOAD_MAX_IMAGES;
const MAX_FILE_SIZE = UPLOAD_MAX_FILE_SIZE_BYTES;

const MARKET_STATUS = {
  selling: '판매 중',
  sold: '판매 완료',
};

const MARKET_APPROVAL = {
  pending: '미승인',
  approved: '승인됨',
};

const MARKET_CATEGORIES = {
  books: '도서',
  electronics: '전자기기',
  fashion: '의류/잡화',
  hobby: '취미/굿즈',
  ticket: '티켓/교환권',
  etc: '기타',
};

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeImages = (images = []) =>
  (Array.isArray(images) ? images : [])
    .slice(0, MAX_IMAGES)
    .map((image, index) => ({
      id: image?.id || `gm-img-${index + 1}`,
      name: image?.name || `image-${index + 1}.jpg`,
      url: toAbsoluteApiUrl(image?.url),
      size: image?.size != null ? toSafeNumber(image.size, undefined) : undefined,
      mime: image?.mime || undefined,
    }))
    .filter((image) => Boolean(image.url));

const normalizeContact = (input = {}) => ({
  studentId: String(input?.studentId || input?.student_id || '').trim(),
  openChatUrl: String(input?.openChatUrl || input?.open_chat_url || '').trim(),
  extra: String(input?.extra || '').trim(),
});

const normalizePost = (post = {}) => {
  const category = Object.prototype.hasOwnProperty.call(MARKET_CATEGORIES, post.category)
    ? post.category
    : 'etc';
  const status = post.status === 'sold' ? 'sold' : 'selling';
  const approvalStatus = post.approvalStatus === 'approved' ? 'approved' : 'pending';
  const normalizedImages = normalizeImages(post.images);

  return {
    id: String(post.id ?? ''),
    title: String(post.title ?? ''),
    description: String(post.description ?? ''),
    price: Math.max(0, Math.floor(toSafeNumber(post.price ?? 0, 0))),
    category,
    status,
    approvalStatus,
    images: normalizedImages,
    imageCount: Number(post.imageCount ?? post.image_count ?? normalizedImages.length),
    contact: normalizeContact(post.contact),
    author: {
      id: post.author?.id ?? null,
      name: post.author?.name ?? post.author?.nickname ?? '익명',
      role: post.author?.role ?? 'student',
    },
    createdAt: post.createdAt || post.created_at || new Date().toISOString(),
    updatedAt: post.updatedAt || post.updated_at || new Date().toISOString(),
    views: Math.max(0, toSafeNumber(post.views ?? 0, 0)),
  };
};

export const gomsolMarketApi = {
  MAX_IMAGES,
  MAX_FILE_SIZE,
  statusLabel: MARKET_STATUS,
  approvalLabel: MARKET_APPROVAL,
  categoryLabel: MARKET_CATEGORIES,

  canWrite(user) {
    return Boolean(user?.id);
  },

  canManageApproval(user) {
    return user?.role === 'admin';
  },

  canManageSaleStatus(user, post) {
    if (!user || !post) return false;
    if (user.role === 'admin') return true;
    return String(user.id) === String(post.author?.id);
  },

  async list(params = {}) {
    const serverParams = {
      status: params.status,
      category: params.category,
      approval: params.approval,
      sort: params.sort,
      q: params.q,
      page: params.page,
      pageSize: params.pageSize,
      view: 'list',
    };
    const res = await api.get('/api/community/gomsol-market', { params: serverParams });
    const normalized = normalizePaginatedResponse(res.data, PAGE_SIZE_DEFAULT);
    return {
      ...normalized,
      items: (normalized.items || []).map(normalizePost),
    };
  },

  async detail(id, params = {}) {
    const res = await api.get(`/api/community/gomsol-market/${id}`, { params });
    return normalizePost(res.data);
  },

  async create(payload = {}) {
    try {
      const res = await api.post('/api/community/gomsol-market', payload);
      const created = normalizePost(res.data);
      trackPostCreated({
        boardType: 'gomsol_market',
        userRole: created?.author?.role ?? payload?.author?.role,
        approvalStatus: created?.approvalStatus ?? created?.status,
      });
      return created;
    } catch (err) {
      trackPostCreateFailed({
        boardType: 'gomsol_market',
        userRole: payload?.author?.role,
        errorType: err,
      });
      throw err;
    }
  },

  async approve(id) {
    const res = await api.post(`/api/community/gomsol-market/${id}/approve`);
    return normalizePost(res.data);
  },

  async unapprove(id) {
    const res = await api.post(`/api/community/gomsol-market/${id}/unapprove`);
    return normalizePost(res.data);
  },

  async updateStatus(id, status) {
    const res = await api.post(`/api/community/gomsol-market/${id}/status`, { status });
    return normalizePost(res.data);
  },

  async upload(file) {
    if (!file) throw new Error('파일이 없습니다.');
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`이미지는 ${UPLOAD_MAX_FILE_SIZE_MB}MB 이하만 업로드할 수 있습니다.`);
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/api/community/gomsol-market/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return normalizeUploadResponse(res.data);
  },
};

export default gomsolMarketApi;


