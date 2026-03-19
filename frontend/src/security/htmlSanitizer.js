/**
 * @file src/security/htmlSanitizer.js
 * @description Centralizes client-side safety guards for storage, URLs, and HTML handling.
 * Responsibilities:
 * - Enforce frontend trust boundaries before rendering or navigating untrusted values.
 * Key dependencies:
 * - dompurify
 * - ./urlPolicy
 * Side effects:
 * - Applies frontend trust-boundary checks for URLs, HTML content, and token persistence.
 * - Interacts with browser runtime APIs.
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Protects rendering and navigation surfaces against unsafe input.
 */
import DOMPurify from 'dompurify';
import { toSafeAssetUrl, toSafeExternalHref } from './urlPolicy';
import { toAbsoluteApiUrl } from '../api/normalizers';

const ALLOWED_TAGS = [
  'p',
  'br',
  'div',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'a',
  'img',
  'blockquote',
  'pre',
  'code',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title'];

function sanitizeLinkElement(anchor) {
  const href = anchor.getAttribute('href');
  const safeHref = toSafeExternalHref(href);
  if (!safeHref) {
    anchor.removeAttribute('href');
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
    return;
  }

  // Re-resolve backend-relative links after sanitization so rich text can
  // safely point at FastAPI-served field-trip uploads as well as Flask assets.
  anchor.setAttribute('href', toAbsoluteApiUrl(safeHref));
  if (anchor.getAttribute('target') === '_blank') {
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
}

function sanitizeImageElement(img) {
  const src = img.getAttribute('src');
  const safeSrc = toSafeAssetUrl(src);
  if (!safeSrc) {
    img.remove();
    return;
  }
  // Rich editors store relative upload paths; convert them back to the correct
  // backend origin before the HTML reaches the DOM.
  img.setAttribute('src', toAbsoluteApiUrl(safeSrc));
}

function sanitizeUriAttributes(cleanHtml) {
  if (typeof window === 'undefined' || !cleanHtml) return cleanHtml || '';

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(cleanHtml, 'text/html');
  doc.body.querySelectorAll('a').forEach(sanitizeLinkElement);
  doc.body.querySelectorAll('img').forEach(sanitizeImageElement);
  return doc.body.innerHTML;
}

/**
 * sanitizeRichHtml module entry point.
 */
export function sanitizeRichHtml(rawHtml) {
  const source = typeof rawHtml === 'string' ? rawHtml : '';
  if (!source) return '';

  const clean = DOMPurify.sanitize(source, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    KEEP_CONTENT: true,
  });

  return sanitizeUriAttributes(clean);
}

/**
 * toPlainText module entry point.
 */
export function toPlainText(rawHtml) {
  const clean = sanitizeRichHtml(rawHtml);
  if (!clean) return '';
  if (typeof window === 'undefined') return clean.replace(/<[^>]+>/g, ' ').trim();

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  return (doc.body.textContent || '').trim();
}


