/**
 * @file src/components/security/SafeHtml.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react
 * - ../../security/htmlSanitizer
 * Side effects:
 * - Applies sanitization before rendering or using external URL/HTML values.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { useMemo } from 'react';
import { sanitizeRichHtml } from '../../security/htmlSanitizer';

/**
 * SafeHtml module entry point.
 */
export default function SafeHtml({ html, className, fallback = '', as = 'div' }) {
  const Tag = as;
  const sanitized = useMemo(() => sanitizeRichHtml(html || ''), [html]);
  const safeFallback = useMemo(() => sanitizeRichHtml(fallback || ''), [fallback]);
  const safeContent = sanitized || safeFallback;

  if (!safeContent) return null;

  return <Tag className={className} dangerouslySetInnerHTML={{ __html: safeContent }} />;
}

