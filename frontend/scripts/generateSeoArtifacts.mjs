import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { getSitemapEntries, resolveSeoFeatureFlags } from '../src/seo/policy.js';
import { SITE_URL } from '../src/seo/site.js';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, '..');
const publicDir = join(rootDir, 'public');
const mode = process.argv[2] || process.env.NODE_ENV || 'production';
const env = {
  ...loadEnv(mode, rootDir, ''),
  ...process.env,
};
const seoFeatureFlags = resolveSeoFeatureFlags(env);

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function writeSeoArtifacts() {
  const sitemapEntries = getSitemapEntries(new Date(), seoFeatureFlags);
  const robotsTxt = ['User-agent: *', 'Allow: /', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join(
    '\n'
  );
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapEntries.map((entry) => {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(`${SITE_URL}${entry.path}`)}</loc>`,
      ];

      if (entry.changefreq) {
        lines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
      }

      if (entry.priority != null) {
        lines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
      }

      lines.push('  </url>');
      return lines.join('\n');
    }),
    '</urlset>',
    '',
  ].join('\n');

  await mkdir(publicDir, { recursive: true });
  await writeFile(join(publicDir, 'robots.txt'), robotsTxt, 'utf8');
  await writeFile(join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');
}

await writeSeoArtifacts();
