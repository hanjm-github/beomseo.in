import { API_BASE_URL, FASTAPI_BASE_URL } from '../../config/env';
import { toSafeAssetUrl } from '../../security/urlPolicy.js';

const IMG_TAG_SRC_RE =
  /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))[^>]*>/gi;
const FIELD_TRIP_UPLOAD_ROUTE_PREFIX = '/api/community/field-trip/uploads';

function toAbsoluteFieldTripImageUrl(rawUrl) {
  const safeUrl = toSafeAssetUrl(rawUrl);
  if (!safeUrl) {
    return null;
  }

  if (safeUrl.startsWith('blob:') || /^https?:\/\//i.test(safeUrl)) {
    return safeUrl;
  }

  const normalized = safeUrl.startsWith('api/') ? `/${safeUrl}` : safeUrl;
  const baseUrl = normalized.startsWith(FIELD_TRIP_UPLOAD_ROUTE_PREFIX)
    ? FASTAPI_BASE_URL
    : API_BASE_URL;
  const prefix = normalized.startsWith('/') ? '' : '/';

  return `${baseUrl}${prefix}${normalized}`;
}

export function getFirstBodyImageUrl(bodyHtml) {
  const source = String(bodyHtml || '');
  if (!source) {
    return null;
  }

  let match;
  while ((match = IMG_TAG_SRC_RE.exec(source))) {
    const rawSrc = match[1] || match[2] || match[3] || '';
    const safeSrc = toSafeAssetUrl(rawSrc);

    if (!safeSrc) {
      continue;
    }

    return toAbsoluteFieldTripImageUrl(safeSrc);
  }

  return null;
}
