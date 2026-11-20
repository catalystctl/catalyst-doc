/**
 * docs-meta.mjs — shared reading of the docs collection for the SEO/AEO build
 * steps (scripts/generate-llms.mjs, scripts/enrich-sitemap.mjs).
 *
 * Deliberately dependency-free: the frontmatter we need (title, description,
 * audience, last_verified) is a flat subset of the contract in AGENTS.md, and
 * the sidebar is a plain array literal inside astro.config.mjs, so both can be
 * read without a YAML parser or a running Astro instance.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DOCS_DIR = resolve(ROOT, 'src/content/docs');
export const SITE = 'https://docs.catalystctl.com';
export const PRODUCT_SITE = 'https://catalystctl.com';

const unquote = (v) => {
  const t = v.trim();
  const m = /^(['"])([\s\S]*)\1$/.exec(t);
  return m ? m[2] : t;
};

/** Split a page into its YAML frontmatter map and its markdown body. */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^[ \t]*-[ \t]+(.*)$/.exec(line);
    if (item && key) {
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const value = kv[2].trim();
      data[key] = value === '' ? [] : unquote(value);
      continue;
    }
    if (/^[ \t]/.test(line)) continue; // nested block of a field we ignore
    key = null;
  }
  return { data, body: text.slice(m[0].length) };
}

const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);

/** Normalise a frontmatter date/string to `YYYY-MM-DD`, or undefined. */
export function toIsoDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const m = /(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return m ? m[1] : undefined;
}

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, `${base}${entry}/`));
    else if (/\.(md|mdx)$/.test(entry)) out.push(`${base}${entry}`);
  }
  return out;
}

/** Every docs page, keyed by its Starlight slug (`index` for the splash page). */
export function listDocs() {
  return walk(DOCS_DIR).map((rel) => {
    const file = resolve(DOCS_DIR, rel);
    const source = readFileSync(file, 'utf-8');
    const { data, body } = parseFrontmatter(source);
    const slug = rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
    return {
      slug,
      rel,
      file,
      body,
      title: data.title,
      description: data.description,
      audience: asList(data.audience),
      features: asList(data.features),
      sources: asList(data.sources),
      lastVerified: toIsoDate(data.last_verified),
      url: slug === 'index' ? `${SITE}/` : `${SITE}/${slug}/`,
    };
  });
}

/**
 * Read the Starlight sidebar out of astro.config.mjs.
 *
 * The `sidebar: [...]` value is a pure array literal (no imports, no calls),
 * so it is sliced out and evaluated instead of re-declared here — the sidebar
 * stays the single source of truth for order, groups and labels.
 */
export function loadSidebar() {
  const config = readFileSync(resolve(ROOT, 'astro.config.mjs'), 'utf-8');
  const marker = config.indexOf('sidebar: [');
  if (marker === -1) throw new Error('astro.config.mjs: no `sidebar: [` found');
  const open = config.indexOf('[', marker);
  let depth = 0;
  let quote = null;
  let end = -1;
  for (let i = open; i < config.length; i++) {
    const c = config[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && config[i + 1] === '/') { i = config.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '/' && config[i + 1] === '*') { i = config.indexOf('*/', i) + 1; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('astro.config.mjs: unterminated sidebar array');
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict"; return (${config.slice(open, end + 1)});`)();
}

/**
 * Flatten the sidebar into `{ group, groups, batch }` — `group` is the
 * top-level section, `groups` the nested group labels, `slug` the page.
 * Entries with an external `link` (no slug) are returned with `href`.
 */
export function flattenSidebar(sidebar) {
  const flat = [];
  for (const top of sidebar) {
    const topLabel = top.label ?? 'Docs';
    for (const entry of top.items ?? [top]) {
      const nested = Array.isArray(entry.items) ? entry.items : null;
      if (nested) {
        for (const leaf of nested) {
          if (Array.isArray(leaf.items)) {
            for (const page of leaf.items) flat.push({ top: topLabel, sub: leaf.label, ...pick(page) });
          } else {
            flat.push({ top: topLabel, sub: entry.label, ...pick(leaf) });
          }
        }
      } else {
        flat.push({ top: topLabel, sub: null, ...pick(entry) });
      }
    }
  }
  return flat;
}

const pick = (entry) => ({
  label: entry.label,
  slug: entry.slug ? String(entry.slug).replace(/\/$/, '') : undefined,
  href: entry.link,
});
