import { toSafeAssetUrl } from '../security/urlPolicy';
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export function toAbsoluteApiUrl(url) {
  const safeUrl = toSafeAssetUrl(url);
  if (!safeUrl) return '';
  if (safeUrl.startsWith('http://') || safeUrl.startsWith('https://') || safeUrl.startsWith('blob:')) {
    return safeUrl;
  }
  const prefix = safeUrl.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${prefix}${safeUrl}`;
}

export function normalizePaginatedResponse(data, fallbackPageSize = 0) {
  if (!data || typeof data !== 'object') {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: fallbackPageSize,
      page_size: fallbackPageSize,
    };
  }

  const normalizedPageSize = Number(data.pageSize ?? data.page_size ?? fallbackPageSize ?? 0);
  return {
    ...data,
    pageSize: normalizedPageSize,
    page_size: Number(data.page_size ?? normalizedPageSize),
  };
}

export function normalizeUploadResponse(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    url: toAbsoluteApiUrl(data.url),
  };
}
