/**
 * @file src/security/surveySchemaSanitizer.js
 * @description Sanitizes survey form schema data before rendering third-party builders.
 */
import { toSafeAssetUrl, toSafeExternalHref } from './urlPolicy.js';

const LINK_FIELD_NAMES = new Set(['href', 'link', 'url', 'targetUrl']);
const ASSET_FIELD_NAMES = new Set(['src', 'imageUrl', 'iconUrl']);

function sanitizeStringField(key, value) {
  if (typeof value !== 'string') return value;

  if (LINK_FIELD_NAMES.has(key)) {
    return toSafeExternalHref(value) || '';
  }

  if (ASSET_FIELD_NAMES.has(key)) {
    return toSafeAssetUrl(value) || '';
  }

  return value;
}

function sanitizeNode(node) {
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeNode(item));
  }

  if (!node || typeof node !== 'object') {
    return node;
  }

  const next = {};
  Object.entries(node).forEach(([key, value]) => {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      next[key] = sanitizeNode(value);
      return;
    }
    next[key] = sanitizeStringField(key, value);
  });

  const elementType = String(next.element || next.field_name || next.type || '').toLowerCase();
  if (elementType === 'hyperlink' || elementType === 'link') {
    const safeHref = toSafeExternalHref(next.href);
    next.href = safeHref || '#';
    if (next.target === '_blank') {
      next.rel = 'noopener noreferrer';
    }
  }

  return next;
}

/**
 * sanitizeSurveyFormSchema module entry point.
 */
export function sanitizeSurveyFormSchema(formSchema) {
  if (!Array.isArray(formSchema)) return [];
  return sanitizeNode(formSchema);
}

export default sanitizeSurveyFormSchema;
