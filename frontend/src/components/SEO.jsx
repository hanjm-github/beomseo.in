/**
 * @file src/components/SEO.jsx
 * @description Reusable SEO component providing per-page meta tags and structured data.
 * Responsibilities:
 * - Render <title>, <meta>, Open Graph, and Twitter Card tags natively.
 * - Inject JSON-LD structured data for enhanced search engine understanding.
 * - None (native React 19 metadata)
 * Side effects:
 * - Modifies the document <head> via React 19 native hoisting.
 * Role in app flow:
 * - Drop-in component used at the top of every SEO-relevant page.
 */
import { getStaticRouteSeo } from '../seo/policy';
import {
  buildCanonicalUrl,
  buildDocumentTitle,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE_URL,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  SITE_LOCALE,
  SITE_NAME,
  toAbsoluteAssetUrl,
} from '../seo/site';

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

  if (typeof window === 'undefined') {
    return null;
  }

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

  return (
    <>
      {/* Basic */}
      <title>{pageTitle}</title>
      <meta name="description" content={resolvedDescription} />
      {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
      <meta name="robots" content={robotsContent} />

      {/* Open Graph */}
      <meta property="og:type" content={resolvedType} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={resolvedDescription} />
      {canonicalUrl ? <meta property="og:url" content={canonicalUrl} /> : null}
      <meta property="og:image" content={resolvedImage} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={SITE_LOCALE} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedImage} />

      {/* JSON-LD structured data */}
      {allJsonLd.map((schema, index) => (
        <script key={`jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </>
  );
}
