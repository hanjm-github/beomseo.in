/**
 * @file src/security/urlPolicy.js
 * @description Centralizes client-side safety guards for storage, URLs, and HTML handling.
 * Responsibilities:
 * - Enforce frontend trust boundaries before rendering or navigating untrusted values.
 * Key dependencies:
 * - ../config/env
 * Side effects:
 * - Applies frontend trust-boundary checks for URLs, HTML content, and token persistence.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Protects rendering and navigation surfaces against unsafe input.
 */
import { ALLOWED_ASSET_HOSTS } from '../config/env.js';

const DANGEROUS_SCHEME_RE = /^(?:javascript|data|vbscript|file):/i;
const EXTERNAL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const WILDCARD_HOST = '*';

const NORMALIZED_ALLOWED_ASSET_HOSTS = (ALLOWED_ASSET_HOSTS || [])
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

function isAllowedAssetHost(hostname) {
  if (!hostname) return false;
  if (!NORMALIZED_ALLOWED_ASSET_HOSTS.length) return true;
  if (NORMALIZED_ALLOWED_ASSET_HOSTS.includes(WILDCARD_HOST)) return true;

  const host = hostname.toLowerCase();
  return NORMALIZED_ALLOWED_ASSET_HOSTS.some((allowed) => {
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(2);
      return host === suffix || host.endsWith(`.${suffix}`);
    }
    return host === allowed;
  });
}

function sanitizeInput(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if ((code >= 0 && code <= 31) || code === 127) return '';
  }
  return trimmed;
}

function safeParse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * toSafeExternalHref module entry point.
 */
export function toSafeExternalHref(rawUrl) {
  const value = sanitizeInput(rawUrl);
  if (!value) return null;

  if (DANGEROUS_SCHEME_RE.test(value)) return null;
  if (value.startsWith('/') || value.startsWith('#')) return value;

  const lower = value.toLowerCase();
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) return value;
  if (!EXTERNAL_SCHEME_RE.test(value)) return null;

  const parsed = safeParse(value);
  if (!parsed) return null;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.href;
}

/**
 * toSafeOpenChatHref module entry point.
 */
export function toSafeOpenChatHref(rawUrl) {
  const value = sanitizeInput(rawUrl);
  if (!value) return null;
  if (DANGEROUS_SCHEME_RE.test(value)) return null;

  const candidate = EXTERNAL_SCHEME_RE.test(value) ? value : `https://${value}`;
  const parsed = safeParse(candidate);
  if (!parsed) return null;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  if (host !== 'open.kakao.com' && !host.endsWith('.open.kakao.com')) return null;
  return parsed.href;
}

/**
 * toSafeAssetUrl module entry point.
 */
export function toSafeAssetUrl(rawUrl) {
  const value = sanitizeInput(rawUrl);
  if (!value) return null;
  if (DANGEROUS_SCHEME_RE.test(value)) return null;
  if (value.startsWith('//')) return null;

  if (value.startsWith('blob:')) return value;
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return value;

  if (EXTERNAL_SCHEME_RE.test(value)) {
    const parsed = safeParse(value);
    if (!parsed) return null;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!isAllowedAssetHost(parsed.hostname)) return null;
    return parsed.href;
  }

  return value;
}
