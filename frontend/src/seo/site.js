export const SITE_NAME = 'beomseo.in(범서인)';
export const SITE_URL = 'https://beomseo.in';
export const SITE_LANGUAGE = 'ko';
export const SITE_LOCALE = 'ko_KR';

export const DEFAULT_TITLE = 'beomseo.in(범서인) — 범서고 학교 생활 플랫폼';
export const DEFAULT_DESCRIPTION =
  '범서고 학생을 위한 학교 생활 정보와 커뮤니티를 빠르게 확인할 수 있는 beomseo.in(범서인)';
export const DEFAULT_OG_IMAGE_PATH = '/og-image.png';
export const DEFAULT_OG_IMAGE_URL = `${SITE_URL}${DEFAULT_OG_IMAGE_PATH}`;

export const INDEX_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
export const NOINDEX_ROBOTS = 'noindex,follow';

export function normalizePathname(pathname = '/') {
  const [pathOnly] = String(pathname || '/').split(/[?#]/, 1);
  const normalized = pathOnly.replace(/\/+$/, '');
  return normalized || '/';
}

export function buildCanonicalUrl(pathname = '/') {
  return `${SITE_URL}${normalizePathname(pathname)}`;
}

export function toAbsoluteAssetUrl(value = DEFAULT_OG_IMAGE_URL) {
  if (!value) return DEFAULT_OG_IMAGE_URL;
  return String(value).startsWith('http') ? String(value) : `${SITE_URL}${value}`;
}

export function buildDocumentTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
}
