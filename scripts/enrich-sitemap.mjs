#!/usr/bin/env node
/**
 * enrich-sitemap.mjs — give the generated sitemap real `<lastmod>` dates.
 *
 * @astrojs/sitemap writes `<url><loc/></url>` entries with no timestamps, which
 * tells a crawler nothing about freshness. Every docs page carries an honest
 * `last_verified` date in its frontmatter (the date a human last checked the
 * page against the product), so this step injects it as `<lastmod>` — for
 * answer engines that is the difference between re-fetching a page and
 * trusting a stale cached copy.
 *
 * Runs after `astro build` (see the `build` script in package.json).
 *
 * Usage: node scripts/enrich-sitemap.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SITE, ROOT, listDocs } from './lib/docs-meta.mjs';

const DIST = resolve(ROOT, 'dist');
const docs = listDocs();
const newestDocsDate = docs.map((d) => d.lastVerified).filter(Boolean).sort().at(-1);
const lastmodBySlug = new Map(docs.map((d) => [d.slug, d.lastVerified]));

const slugOfUrl = (url) => {
  if (!url.startsWith(SITE)) return undefined;
  const path = url.slice(SITE.length).replace(/^\//, '').replace(/\/$/, '');
  return path === '' ? 'index' : path;
};

if (!existsSync(DIST)) {
  console.error('enrich-sitemap: no dist/ — run `astro build` first');
  process.exit(1);
}

const sitemaps = readdirSync(DIST).filter((f) => /^sitemap(-\d+)?\.xml$/.test(f)).sort();
if (sitemaps.length === 0) {
  console.error('enrich-sitemap: dist/ has no sitemap-*.xml — is @astrojs/sitemap enabled?');
  process.exit(1);
}

let written = 0;
let stamped = 0;
let missing = 0;
let newest;
for (const file of sitemaps) {
  const path = resolve(DIST, file);
  const xml = readFileSync(path, 'utf-8');
  const out = xml.replace(/<url>([\s\S]*?)<\/url>/g, (block, inner) => {
    written++;
    const loc = /<loc>([^<]+)<\/loc>/.exec(inner)?.[1];
    const slug = loc ? slugOfUrl(loc) : undefined;
    let lastmod = slug ? lastmodBySlug.get(slug) : undefined;
    if (!lastmod && slug === 'index') lastmod = newestDocsDate;
    if (!lastmod) {
      missing++;
      return block;
    }
    stamped++;
    if (!newest || lastmod > newest) newest = lastmod;
    // `<lastmod>` belongs immediately after `<loc>` and replaces any stale one.
    const body = inner.replace(/\s*<lastmod>[^<]*<\/lastmod>/, '');
    return `<url>${body.replace(/(<loc>[^<]+<\/loc>)/, `$1<lastmod>${lastmod}</lastmod>`)}</url>`;
  });
  if (out !== xml) writeFileSync(path, out);
}

// The index entry points at the shards; stamp it with the newest page date.
const indexPath = resolve(DIST, 'sitemap-index.xml');
if (existsSync(indexPath) && newest) {
  const index = readFileSync(indexPath, 'utf-8');
  const stampedIndex = index.replace(/(<sitemap>\s*<loc>[^<]+<\/loc>)/g, `$1<lastmod>${newest}</lastmod>`);
  if (stampedIndex !== index) writeFileSync(indexPath, stampedIndex);
}

console.log(
  `enrich-sitemap: ${stamped}/${written} url(s) stamped with <lastmod> (newest ${newest ?? 'n/a'}), ` +
    `${missing} without a docs page (no last_verified)`,
);
if (stamped === 0) {
  console.error('enrich-sitemap: no url matched a docs page — check the site URL and content paths');
  process.exit(1);
}
