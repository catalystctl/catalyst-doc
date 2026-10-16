#!/usr/bin/env node
/**
 * validate-docs.mjs — CI validation for the Catalyst docs site.
 *
 * Checks (all hard failures unless noted):
 *  1. Every sidebar slug in astro.config.mjs resolves to a content file.
 *  2. No duplicate slugs / orphaned pages (warn-only for orphans).
 *  3. Required frontmatter: title, description, audience (non-empty, known
 *     values, no duplicates), features (non-empty, canonical vocabulary),
 *     sources (non-empty) and last_verified (YYYY-MM-DD) on every page
 *     except the splash index.
 *  4. Internal links ([text](...)) resolve: absolute (/x/y/), relative
 *     (./, ../), same-page anchors (#...), checked against content files
 *     and heading anchors in the target page.
 *  5. Referenced local images/assets exist.
 *  6. api/openapi.json is a valid OpenAPI 3.1 doc and public/openapi.json
 *     matches it (delegates to sync-openapi.mjs --check).
 *  7. Terminology lint (delegates to check-terminology.mjs).
 *
 * Usage: node scripts/validate-docs.mjs [--strict]
 * --strict turns orphan-page warnings into failures.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = resolve(root, 'src/content/docs');
const strict = process.argv.includes('--strict');
let failures = 0;
let warnings = 0;

const fail = (msg) => { console.error(`FAIL  ${msg}`); failures++; };
const warn = (msg) => { console.log(`WARN  ${msg}`); warnings++; };
const ok = (msg) => { console.log(`ok    ${msg}`); };

function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = resolve(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full, `${base}${e}/`));
    else if (/\.(md|mdx)$/.test(e)) out.push(`${base}${e.replace(/\.(md|mdx)$/, '')}`);
  }
  return out;
}

// Slug for a content path: strip trailing /index.
const toSlug = (p) => p.replace(/\/index$/, '');
const pages = new Map(walk(docsDir).map((p) => [toSlug(p), p]));

// --- 1+2. Sidebar slugs -------------------------------------------------------
const astroConfig = readFileSync(resolve(root, 'astro.config.mjs'), 'utf-8');
const sidebarSlugs = [...astroConfig.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((m) => m[1].replace(/\/$/, ''));
const seen = new Set();
for (const slug of sidebarSlugs) {
  if (seen.has(slug)) fail(`duplicate sidebar slug: ${slug}`);
  seen.add(slug);
  if (!pages.has(slug)) fail(`sidebar slug has no page: ${slug}`);
}
const orphaned = [...pages.keys()].filter((s) => s !== 'index' && !seen.has(s));
for (const o of orphaned) {
  const msg = `page not in sidebar (unreachable from nav): ${o}`;
  if (strict) fail(msg); else warn(msg);
}
ok(`sidebar: ${sidebarSlugs.length} slugs resolve, ${orphaned.length} orphan(s)`);

// --- 3. Frontmatter -----------------------------------------------------------
const AUDIENCES = new Set(['user', 'admin', 'developer']);
// Canonical `features` vocabulary (see /tmp/DOCS-STAGE2-SPEC.md and AGENTS.md).
// Pages tag themselves with values from this set so the sidebar, search and the
// docs agent stay in sync; an ad-hoc tag is a hard failure, not a warning.
const FEATURES = new Set([
  'getting-started', 'installation', 'configuration', 'administration',
  'users-and-access', 'permissions', 'security', 'nodes', 'servers', 'console',
  'files', 'sftp', 'backups', 'databases', 'networking', 'tasks',
  'mods-and-plugins', 'monitoring', 'storage', 'templates', 'updates',
  'migration', 'disaster-recovery', 'api', 'api-auth', 'api-errors',
  'websockets', 'plugin-development', 'troubleshooting', 'contributing',
]);
// A YAML block list, e.g. `features:\n  - backups\n  - monitoring`.
const listBlock = (fm, key) => fm.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-\\s+.*\\n?)+)`, 'm'));
const listValues = (block) => (block ? [...block[1].matchAll(/-\s+(\S+)/g)].map((x) => x[1]) : []);
const fmRe = /^---\n([\s\S]*?)\n---/;
for (const [slug, rel] of pages) {
  const file = resolve(docsDir, `${rel}.mdx`);
  const alt = resolve(docsDir, `${rel}.md`);
  const src = readFileSync(existsSync(file) ? file : alt, 'utf-8');
  const m = src.match(fmRe);
  if (!m) { fail(`${slug}: missing frontmatter`); continue; }
  const fm = m[1];
  const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!title) fail(`${slug}: frontmatter needs title`);
  if (!desc) fail(`${slug}: frontmatter needs description`);

  // audience: a non-empty list of known values, each declared exactly once
  // (a page has one primary audience even when it serves several roles).
  const audBlock = listBlock(fm, 'audience');
  if (slug !== 'index' && listValues(audBlock).length === 0) {
    fail(`${slug}: frontmatter needs a non-empty audience list`);
  } else if (audBlock) {
    const declared = new Set();
    for (const a of listValues(audBlock)) {
      if (!AUDIENCES.has(a)) fail(`${slug}: unknown audience '${a}'`);
      if (declared.has(a)) fail(`${slug}: audience '${a}' declared twice — one page, one primary audience`);
      declared.add(a);
    }
  }

  if (slug !== 'index') {
    // features: required and restricted to the canonical vocabulary.
    const feats = listValues(listBlock(fm, 'features'));
    if (feats.length === 0) {
      fail(`${slug}: frontmatter needs a non-empty features list`);
    } else {
      for (const f of feats) {
        if (!FEATURES.has(f)) fail(`${slug}: unknown feature '${f}' — use the canonical features vocabulary`);
      }
    }
    // sources + last_verified: required so change mapping stays reliable.
    if (listValues(listBlock(fm, 'sources')).length === 0) {
      fail(`${slug}: frontmatter needs a non-empty sources list`);
    }
    const lv = fm.match(/^last_verified:\s*(.*)$/m)?.[1]?.trim();
    if (!lv) fail(`${slug}: frontmatter needs last_verified (YYYY-MM-DD)`);
    else if (!/^['"]?\d{4}-\d{2}-\d{2}['"]?$/.test(lv)) fail(`${slug}: last_verified must be YYYY-MM-DD`);
  } else {
    const lv = fm.match(/^last_verified:\s*['"]?([\d-]+)['"]?/m)?.[1];
    if (lv && !/^\d{4}-\d{2}-\d{2}$/.test(lv)) fail(`${slug}: last_verified must be YYYY-MM-DD`);
  }

  // Starlight asides need `:::note` (no space) — `::: note` renders literally,
  // and a titled spaced directive (`::: caution[Title]`) is broken the same way.
  const spaced = [...src.matchAll(/^:::[ \t]+(note|tip|caution|danger)\b[^\n]*/gm)];
  if (spaced.length > 0) fail(`${slug}: spaced aside directive(s) will not render: ${spaced.map((x) => x[0].trim()).join(', ')}`);
}
ok('frontmatter checked');

// --- 4+5. Links and assets ----------------------------------------------------
function anchorsOf(src) {
  const anchors = new Set();
  for (const h of src.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    anchors.add(h[1].trim().toLowerCase().replace(/`([^`]*)`/g, '$1')
      .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'));
  }
  return anchors;
}
const sources = new Map();
for (const [slug, rel] of pages) {
  const file = resolve(docsDir, `${rel}.mdx`);
  const alt = resolve(docsDir, `${rel}.md`);
  const p = existsSync(file) ? file : alt;
  sources.set(slug, { path: p, text: readFileSync(p, 'utf-8') });
}
const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const [slug, { path, text }] of sources) {
  const dir = posix.dirname(slug);
  for (const m of text.matchAll(linkRe)) {
    const href = m[2];
    if (/^(https?:|mailto:|#)/.test(href)) {
      if (href.startsWith('#')) {
        const a = href.slice(1).toLowerCase();
        if (a && !anchorsOf(text).has(a)) fail(`${slug}: dead same-page anchor #${a}`);
      }
      continue;
    }
    const [linkPath, frag] = href.split('#');
    let target;
    if (linkPath === '') target = slug;
    else if (linkPath.startsWith('/')) target = linkPath.replace(/^\//, '').replace(/\/$/, '');
    else target = posix.normalize(posix.join(dir, linkPath)).replace(/\/$/, '');
    if (/\.(png|jpg|jpeg|gif|svg|webp|ico|mp4|pdf|json|yaml|yml|txt|xml)$/i.test(target)) {
      // Static asset: absolute → public/, relative → page dir, then public/.
      const candidates = [
        resolve(root, 'public', target.replace(/^\//, '')),
        resolve(dirname(path), target),
        resolve(root, 'src/assets', target.replace(/^\//, '')),
      ];
      if (!candidates.some(existsSync)) fail(`${slug}: missing asset ${href}`);
      continue;
    }
    const pageKey = target.replace(/\/$/, '');
    if (!pages.has(pageKey) && !pages.has(`${pageKey}/index`)) {
      fail(`${slug}: dead internal link ${href}`);
      continue;
    }
    if (frag) {
      const t = sources.get(pageKey) ?? sources.get(`${pageKey}/index`);
      if (t && !anchorsOf(t.text).has(frag.toLowerCase())) fail(`${slug}: dead anchor ${href}`);
    }
  }
}
ok('internal links and assets checked');

// --- 6. OpenAPI ----------------------------------------------------------------
try {
  execFileSync(process.execPath, [resolve(root, 'scripts/sync-openapi.mjs'), '--check'], { stdio: 'pipe' });
  const doc = JSON.parse(readFileSync(resolve(root, 'api/openapi.json'), 'utf-8'));
  const ops = Object.values(doc.paths).reduce((n, v) => n + Object.keys(v).length, 0);
  if (ops < 10) fail(`api/openapi.json suspiciously small (${ops} operations)`);
  else ok(`openapi.json valid (${ops} operations, served copy current)`);
} catch (e) {
  fail(`openapi check failed: ${(e.stdout ?? '').toString().trim() || e.message}`);
}

// --- 7. Terminology -------------------------------------------------------------
try {
  execFileSync(process.execPath, [resolve(root, 'scripts/check-terminology.mjs')], { stdio: 'inherit' });
} catch {
  fail('terminology check failed');
}

console.log(`\nvalidate-docs: ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures > 0 ? 1 : 0);
