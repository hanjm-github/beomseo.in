/**
 * @file src/components/SEO.jsx
 * @description Reusable SEO component providing per-page meta tags and structured data.
 * Responsibilities:
 * - Synchronize <title>, <meta>, Open Graph, and Twitter Card tags for the active route.
 * - Inject JSON-LD structured data for enhanced search engine understanding.
 * Side effects:
 * - Replaces SEO-related nodes inside document <head> on route changes.
 * Role in app flow:
 * - Drop-in component used at the top of every SEO-relevant page.
 */
import { useEffect } from 'react';
import { getStaticRouteSeo } from '../seo/policy';
import {
  buildCanonicalUrl,
  DEFAULT_TITLE,
  buildDocumentTitle,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_URL,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  SITE_LOCALE,
  SITE_NAME,
  toAbsoluteAssetUrl,
} from '../seo/site';

const SEO_HEAD_SELECTORS = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'link[rel="canonical"]',
  'script[type="application/ld+json"]',
];

function clearSeoHeadTags(head) {
  SEO_HEAD_SELECTORS.forEach((selector) => {
    head.querySelectorAll(selector).forEach((node) => node.remove());
  });
}

function appendHeadNode(head, tagName, attributes, textContent) {
  const node = document.createElement(tagName);

  Object.entries(attributes).forEach(([name, value]) => {
    if (value == null || value === false) {
      return;
    }

    node.setAttribute(name, String(value));
  });

  if (textContent) {
    node.textContent = textContent;
  }

  head.appendChild(node);
}

/**
 * SEO — renders <head> metadata for a single page.
 *
 * @param {object}  props
 * @param {string}  [props.title]        Page title (automatically appended with site name).
 * @param {string}  [props.description]  Meta description.
 * @param {string}  [props.path]         Canonical path (e.g. "/notices/school"). Defaults to "/".
 * @param {string}  [props.canonicalPath] Canonical path override.
 * @param {string}  [props.type]         Open Graph type: "website" | "article". Default "website".
 * @param {string}  [props.image]        Open Graph image URL. Falls back to default OG image.
 * @param {boolean} [props.noindex]      If true, adds noindex directive.
 * @param {boolean} [props.canonical]    If false, suppresses canonical tag rendering.
 * @param {string}  [props.robots]       Explicit robots value.
 * @param {Array}   [props.jsonLd]       Array of JSON-LD objects to inject as structured data.
 * @param {Array}   [props.breadcrumbs]  Array of { name, url } for BreadcrumbList schema.
 */
export default function SEO({
  title,
  description,
  path = '/',
  canonicalPath,
  type,
  image,
  noindex = false,
  canonical = true,
  robots,
  jsonLd,
  breadcrumbs,
}) {
  const policy = getStaticRouteSeo(path);
  const resolvedTitle = title ?? policy?.title;
  const resolvedDescription = description ?? policy?.description ?? DEFAULT_DESCRIPTION;
  const resolvedType = type ?? policy?.type ?? 'website';
  const resolvedCanonicalPath =
    canonical === false ? null : canonicalPath ?? policy?.canonicalPath ?? path;
  const resolvedImage = toAbsoluteAssetUrl(image || policy?.image || DEFAULT_OG_IMAGE_URL);
  const resolvedBreadcrumbs = breadcrumbs ?? policy?.breadcrumbs ?? [];
  const resolvedJsonLd = jsonLd ?? policy?.jsonLd ?? [];
  const pageTitle = buildDocumentTitle(resolvedTitle);
  const canonicalUrl = resolvedCanonicalPath ? buildCanonicalUrl(resolvedCanonicalPath) : null;
  const robotsContent = robots ?? (noindex || policy?.indexable === false ? NOINDEX_ROBOTS : INDEX_ROBOTS);
  const breadcrumbJsonLd =
    resolvedBreadcrumbs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: resolvedBreadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            item: crumb.url.startsWith('http') ? crumb.url : buildCanonicalUrl(crumb.url),
          })),
        }
      : null;

  const allJsonLd = [...resolvedJsonLd, breadcrumbJsonLd].filter(Boolean);
  const serializedJsonLd = JSON.stringify(allJsonLd);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const head = document.head;
    const jsonLdSchemas = JSON.parse(serializedJsonLd);

    clearSeoHeadTags(head);
    document.title = pageTitle;

    appendHeadNode(head, 'meta', { name: 'description', content: resolvedDescription });
    if (canonicalUrl) {
      appendHeadNode(head, 'link', { rel: 'canonical', href: canonicalUrl });
    }
    appendHeadNode(head, 'meta', { name: 'robots', content: robotsContent });

    appendHeadNode(head, 'meta', { property: 'og:type', content: resolvedType });
    appendHeadNode(head, 'meta', { property: 'og:title', content: pageTitle });
    appendHeadNode(head, 'meta', { property: 'og:description', content: resolvedDescription });
    if (canonicalUrl) {
      appendHeadNode(head, 'meta', { property: 'og:url', content: canonicalUrl });
    }
    appendHeadNode(head, 'meta', { property: 'og:image', content: resolvedImage });
    appendHeadNode(head, 'meta', { property: 'og:site_name', content: SITE_NAME });
    appendHeadNode(head, 'meta', { property: 'og:locale', content: SITE_LOCALE });

    appendHeadNode(head, 'meta', { name: 'twitter:card', content: 'summary_large_image' });
    appendHeadNode(head, 'meta', { name: 'twitter:title', content: pageTitle });
    appendHeadNode(head, 'meta', { name: 'twitter:description', content: resolvedDescription });
    appendHeadNode(head, 'meta', { name: 'twitter:image', content: resolvedImage });

    jsonLdSchemas.forEach((schema) => {
      appendHeadNode(
        head,
        'script',
        { type: 'application/ld+json' },
        JSON.stringify(schema),
      );
    });

    return () => {
      clearSeoHeadTags(head);

      if (document.title === pageTitle) {
        document.title = DEFAULT_TITLE;
      }
    };
  }, [
    canonicalUrl,
    pageTitle,
    resolvedDescription,
    resolvedImage,
    resolvedType,
    robotsContent,
    serializedJsonLd,
  ]);

  return null;
}
