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
import { FASTAPI_BASE_URL } from './fastapiClient';
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
// Some relative API paths are owned by FastAPI rather than Flask, so callers
// can keep passing backend-relative URLs without hard-coding origins.
const FASTAPI_ROUTE_PREFIXES = ['/api/community/field-trip/uploads'];

function resolveBaseUrlForApiPath(pathname = '', defaultBaseUrl = API_BASE_URL) {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) return defaultBaseUrl;

  if (FASTAPI_ROUTE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return FASTAPI_BASE_URL;
  }

  return defaultBaseUrl;
}

/**
 * toAbsoluteApiUrl module entry point.
 */
export function toAbsoluteApiUrl(url, baseUrl = API_BASE_URL) {
  const safeUrl = toSafeAssetUrl(url);
  if (!safeUrl) return '';
  if (safeUrl.startsWith('blob:')) {
    return safeUrl;
  }

  if (safeUrl.startsWith('http://') || safeUrl.startsWith('https://')) {
    // Absolute URLs are trusted as-is to avoid rewriting valid backend origins.
    return safeUrl;
  }

  const normalized = safeUrl.startsWith('api/') ? `/${safeUrl}` : safeUrl;
  const resolvedBaseUrl = resolveBaseUrlForApiPath(normalized, baseUrl);
  const prefix = normalized.startsWith('/') ? '' : '/';
  return `${resolvedBaseUrl}${prefix}${normalized}`;
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
export function normalizeUploadResponse(data, baseUrl = API_BASE_URL) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    url: toAbsoluteApiUrl(data.url, baseUrl),
    canonicalUrl: toAbsoluteApiUrl(data.canonicalUrl, baseUrl) || data.canonicalUrl,
  };
}


