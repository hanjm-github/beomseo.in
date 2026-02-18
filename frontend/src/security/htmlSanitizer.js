import DOMPurify from 'dompurify';
import { toSafeAssetUrl, toSafeExternalHref } from './urlPolicy';

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

  anchor.setAttribute('href', safeHref);
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
  img.setAttribute('src', safeSrc);
}

function sanitizeUriAttributes(cleanHtml) {
  if (typeof window === 'undefined' || !cleanHtml) return cleanHtml || '';

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(cleanHtml, 'text/html');
  doc.body.querySelectorAll('a').forEach(sanitizeLinkElement);
  doc.body.querySelectorAll('img').forEach(sanitizeImageElement);
  return doc.body.innerHTML;
}

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

export function toPlainText(rawHtml) {
  const clean = sanitizeRichHtml(rawHtml);
  if (!clean) return '';
  if (typeof window === 'undefined') return clean.replace(/<[^>]+>/g, ' ').trim();

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  return (doc.body.textContent || '').trim();
}
