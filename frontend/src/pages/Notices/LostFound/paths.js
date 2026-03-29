export const LOST_FOUND_NOTICE_BASE_PATH = '/notices/lost-found';
export const LOST_FOUND_LEGACY_BASE_PATH = '/community/lost-found';

export function buildLostFoundNoticePath(suffix = '') {
  const normalizedSuffix = String(suffix || '').replace(/^\/+/, '');
  return normalizedSuffix
    ? `${LOST_FOUND_NOTICE_BASE_PATH}/${normalizedSuffix}`
    : LOST_FOUND_NOTICE_BASE_PATH;
}
