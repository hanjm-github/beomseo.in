const DANGEROUS_SCHEME_RE = /^(?:javascript|data|vbscript|file):/i;
const EXTERNAL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

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
    return parsed.href;
  }

  return value;
}
