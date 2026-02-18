import { useMemo } from 'react';
import { sanitizeRichHtml } from '../../security/htmlSanitizer';

export default function SafeHtml({ html, className, fallback = '', as = 'div' }) {
  const Tag = as;
  const sanitized = useMemo(() => sanitizeRichHtml(html || ''), [html]);
  const safeFallback = useMemo(() => sanitizeRichHtml(fallback || ''), [fallback]);
  const safeContent = sanitized || safeFallback;

  if (!safeContent) return null;

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: safeContent }} />;
}
