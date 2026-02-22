/**
 * @file src/analytics/zaraz.js
 * @description Wraps analytics instrumentation with privacy-safe payload handling.
 * Responsibilities:
 * - Encapsulate file-local responsibilities in support of the overall frontend architecture.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - Emits analytics events with normalized and privacy-safe payload fields.
 * - Interacts with browser runtime APIs.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Participates as a supporting module in the frontend runtime graph.
 */
const DEFAULT_ALLOWED_HOSTS = ['beomseo.in'];
const DEFAULT_BLOCKED_KEY_NAMES = [
  'nickname',
  'password',
  'email',
  'token',
  'refresh_token',
  'access_token',
];
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseBoolean(value, defaultValue) {
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return defaultValue;
}

function parseCommaSeparatedList(value, fallback = []) {
  if (typeof value !== 'string') return [...fallback];
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : [...fallback];
}

const ALLOWED_HOSTS = new Set(
  parseCommaSeparatedList(import.meta.env.VITE_ANALYTICS_ALLOWED_HOSTS, DEFAULT_ALLOWED_HOSTS).map(
    (host) => host.toLowerCase()
  )
);
const ALLOW_ALL_HOSTS = ALLOWED_HOSTS.has('*');

const BLOCKED_KEY_NAMES = new Set(
  parseCommaSeparatedList(import.meta.env.VITE_ANALYTICS_BLOCKED_KEYS, DEFAULT_BLOCKED_KEY_NAMES).map(
    (key) => key.toLowerCase()
  )
);

const ANALYTICS_ENABLED = parseBoolean(import.meta.env.VITE_ANALYTICS_ENABLED, true);
const ANALYTICS_ALLOW_IN_DEV = parseBoolean(import.meta.env.VITE_ANALYTICS_ALLOW_IN_DEV, false);

function isBlockedKey(key) {
  if (typeof key !== 'string') return false;
  return BLOCKED_KEY_NAMES.has(key.trim().toLowerCase());
}

function sanitizeValue(value) {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const sanitizedItems = value
      .map((item) => sanitizeValue(item))
      .filter((item) => item !== undefined);
    return sanitizedItems;
  }
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (isBlockedKey(key)) return;
      const sanitizedNested = sanitizeValue(nestedValue);
      if (sanitizedNested !== undefined) {
        output[key] = sanitizedNested;
      }
    });
    return output;
  }
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  return value;
}

function sanitizePayload(params = {}) {
  const base = sanitizeValue(params);
  if (!base || typeof base !== 'object') return {};
  return base;
}

function normalizeRole(role) {
  if (typeof role !== 'string') return undefined;
  const trimmed = role.trim().toLowerCase();
  return trimmed || undefined;
}

function extractErrorMessage(errorLike) {
  if (typeof errorLike === 'string') return errorLike;
  if (!errorLike || typeof errorLike !== 'object') return '';
  if (typeof errorLike?.response?.data?.error === 'string') return errorLike.response.data.error;
  if (typeof errorLike?.message === 'string') return errorLike.message;
  return '';
}

/**
 * normalizeErrorType module entry point.
 */
export function normalizeErrorType(errorLike) {
  const status = Number(errorLike?.response?.status || errorLike?.status || 0);
  if (status === 400 || status === 409 || status === 422) return 'validation_error';
  if (status === 401 || status === 403) return 'auth_error';
  if (status >= 500) return 'server_error';

  const code = String(errorLike?.code || '').toLowerCase();
  if (code.includes('network') || code.includes('timeout') || code === 'ecconnaborted') {
    return 'network_error';
  }

  const message = extractErrorMessage(errorLike).toLowerCase();
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return 'network_error';
  }
  if (message.includes('auth') || message.includes('token') || message.includes('login')) {
    return 'auth_error';
  }
  if (message.includes('invalid') || message.includes('required') || message.includes('not valid')) {
    return 'validation_error';
  }

  return 'unknown_error';
}

/**
 * isAnalyticsEnabled module entry point.
 */
export function isAnalyticsEnabled() {
  if (!ANALYTICS_ENABLED) return false;
  if (!ANALYTICS_ALLOW_IN_DEV && !import.meta.env.PROD) return false;
  if (typeof window === 'undefined') return false;
  const hostname = window.location?.hostname?.toLowerCase();
  if (!hostname) return false;
  if (!ALLOW_ALL_HOSTS && !ALLOWED_HOSTS.has(hostname)) return false;
  return true;
}

function getPagePath() {
  if (typeof window === 'undefined') return undefined;
  const pathname = window.location?.pathname || '/';
  const search = window.location?.search || '';
  return `${pathname}${search}`;
}

function getTrackFunction() {
  if (typeof window === 'undefined') return null;
  if (!window.zaraz || typeof window.zaraz.track !== 'function') return null;
  return window.zaraz.track.bind(window.zaraz);
}

/**
 * trackEvent module entry point.
 */
export function trackEvent(eventName, params = {}) {
  if (typeof eventName !== 'string' || !eventName.trim()) return false;
  if (!isAnalyticsEnabled()) return false;

  const track = getTrackFunction();
  if (!track) return false;

  const payload = sanitizePayload(params);
  if (!payload.page_path) {
    payload.page_path = getPagePath();
  }

  try {
    track(eventName.trim(), payload);
    return true;
  } catch {
    return false;
  }
}

/**
 * trackAuthSuccess module entry point.
 */
export function trackAuthSuccess({ eventName, userRole }) {
  const role = normalizeRole(userRole);
  const payload = role ? { user_role: role } : {};
  return trackEvent(eventName, payload);
}

/**
 * trackAuthFailure module entry point.
 */
export function trackAuthFailure({ eventName, errorType }) {
  return trackEvent(eventName, {
    error_type: normalizeErrorType(errorType),
  });
}

/**
 * trackPostCreated module entry point.
 */
export function trackPostCreated({ boardType, userRole, approvalStatus }) {
  const role = normalizeRole(userRole);
  const approval = typeof approvalStatus === 'string' ? approvalStatus : undefined;
  return trackEvent('post_created', {
    board_type: boardType,
    user_role: role,
    approval_status: approval,
  });
}

/**
 * trackPostCreateFailed module entry point.
 */
export function trackPostCreateFailed({ boardType, userRole, errorType }) {
  const role = normalizeRole(userRole);
  return trackEvent('post_create_failed', {
    board_type: boardType,
    user_role: role,
    error_type: normalizeErrorType(errorType),
  });
}


