/**
 * @file src/api/normalizers.js
 * @description Encapsulates backend API contracts, normalization, and fallback behavior.
 * Responsibilities:
 * - Expose a stable API-facing interface for feature code while shielding transport details.
 * Key dependencies:
 * - ../security/urlPolicy
 * Side effects:
 * - Performs HTTP requests to backend endpoints via shared API clients.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Acts as the data boundary between UI code and backend HTTP endpoints.
 */
import { toSafeAssetUrl } from '../security/urlPolicy';
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/**
 * toAbsoluteApiUrl module entry point.
 */
export function toAbsoluteApiUrl(url) {
  const safeUrl = toSafeAssetUrl(url);
  if (!safeUrl) return '';
  if (safeUrl.startsWith('http://') || safeUrl.startsWith('https://') || safeUrl.startsWith('blob:')) {
    return safeUrl;
  }
  const prefix = safeUrl.startsWith('/') ? '' : '/';
  return `${API_BASE_URL}${prefix}${safeUrl}`;
}

/**
 * normalizePaginatedResponse module entry point.
 */
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

/**
 * normalizeUploadResponse module entry point.
 */
export function normalizeUploadResponse(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    url: toAbsoluteApiUrl(data.url),
  };
}


