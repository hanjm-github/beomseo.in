function decodeHtmlEntities(text) {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function stripHtmlToText(value = '') {
  return decodeHtmlEntities(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(value = '', maxLength = 160) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function buildSeoExcerpt(value = '', maxLength = 160) {
  return truncateText(stripHtmlToText(value), maxLength);
}

export function joinSeoText(parts, maxLength = 160, separator = ' · ') {
  const joined = (Array.isArray(parts) ? parts : [])
    .map((part) => stripHtmlToText(part))
    .filter(Boolean)
    .join(separator);
  return truncateText(joined, maxLength);
}
