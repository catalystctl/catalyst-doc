#!/usr/bin/env node
/**
 * generate-llms.mjs — build the machine-readable documentation entry points.
 *
 * Writes two artifacts into public/ (copied verbatim into dist/ by Astro, and
 * referenced from robots.txt):
 *
 *   public/llms.txt       a structured, linked index of every docs page —
 *                         grouped like the Starlight sidebar, one line per page
 *                         with its description, per the llms.txt convention
 *                         (https://llmstxt.org/).
 *   public/llms-full.txt  the whole documentation as plain Markdown, in
 *                         sidebar (reading) order, with frontmatter stripped
 *                         and MDX imports/components removed.
 *
 * Both files are deterministic: no timestamps, so a rebuild with unchanged
 * content produces byte-identical output. Order, labels and group names come
 * from the Starlight sidebar in astro.config.mjs, so the machine-readable index
 * can never drift from the navigation.
 *
 * Usage: node scripts/generate-llms.mjs (runs automatically in `prebuild`).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PRODUCT_SITE,
  ROOT,
  SITE,
  flattenSidebar,
  listDocs,
  loadSidebar,
} from './lib/docs-meta.mjs';

const OUT_INDEX = resolve(ROOT, 'public/llms.txt');
const OUT_FULL = resolve(ROOT, 'public/llms-full.txt');

// Sections the index must present, in this order, with the sidebar label that
// holds them. Anything else in the sidebar (external links, Contributing) is
// routed by the rules below instead of guessing.
const OPTIONAL_GROUPS = new Set(['Contributing']);
const EXTERNAL_GROUPS = new Set(['Catalyst Website']);

// External Catalyst properties worth offering an answer engine alongside the
// docs — they are the bookends of a docs answer (what to install, what to add).
const PRODUCT_LINKS = [
  [`${PRODUCT_SITE}/`, 'Catalyst product site'],
  [`${PRODUCT_SITE}/templates/`, 'Template catalogue — installable game recipes'],
  [`${PRODUCT_SITE}/plugins/`, 'Plugin catalogue'],
  [`${PRODUCT_SITE}/changelog/`, 'Release notes and changelog'],
];

const docs = listDocs();
const bySlug = new Map(docs.map((d) => [d.slug, d]));
const sidebar = flattenSidebar(loadSidebar());

const entry = (page) => {
  const description = page.description ? `: ${page.description}` : '';
  return `- [${page.title ?? page.slug}](${page.url})${description}`;
};

// --- public/llms.txt ---------------------------------------------------------
const sections = new Map(); // top-level label -> { intro: [], subs: Map(label -> []) }
const order = [];
for (const item of sidebar) {
  if (!item.slug || EXTERNAL_GROUPS.has(item.top)) continue;
  const page = bySlug.get(item.slug);
  if (!page) continue;
  if (!sections.has(item.top)) {
    sections.set(item.top, { intro: [], subs: new Map() });
    order.push(item.top);
  }
  const section = sections.get(item.top);
  if (item.sub) {
    if (!section.subs.has(item.sub)) section.subs.set(item.sub, []);
    section.subs.get(item.sub).push(entry(page));
  } else {
    section.intro.push(entry(page));
  }
}
// Any page the sidebar does not reach (an orphan — validate-docs warns about
// these in --strict) still belongs in the machine-readable index.
const listed = new Set(sidebar.map((i) => i.slug).filter(Boolean));
const orphans = docs.filter((d) => d.slug !== 'index' && !listed.has(d.slug));

const indexLines = [
  '# Catalyst Docs',
  '',
  '> Catalyst is a game-server control panel: create and run game servers, edit',
  '> files, schedule backups, manage nodes and users, and automate everything',
  '> through a REST API. This file indexes the complete documentation.',
  '',
  `- Documentation home: ${SITE}/`,
  `- Full documentation in one file: ${SITE}/llms-full.txt`,
  `- REST API contract (OpenAPI 3.1): ${SITE}/openapi.json`,
  `- Catalyst product site index: ${PRODUCT_SITE}/llms.txt`,
  '',
  '## Catalyst products',
  '',
  ...PRODUCT_LINKS.map(([url, label]) => `- [${label}](${url})`),
  '',
];

const renderSection = (label, section) => {
  indexLines.push(`## ${label}`, '');
  if (section.intro.length) indexLines.push(...section.intro, '');
  for (const [sub, items] of section.subs) {
    indexLines.push(`### ${sub}`, '', ...items, '');
  }
};

for (const label of order) {
  if (OPTIONAL_GROUPS.has(label)) continue;
  renderSection(label, sections.get(label));
}
if (orphans.length) {
  indexLines.push('## Other pages', '', ...orphans.sort((a, b) => a.slug.localeCompare(b.slug)).map(entry), '');
}
// `## Optional` marks sections an answer engine may skip without losing the
// product answer (llms.txt convention) — contributor docs live here.
const optional = order.filter((label) => OPTIONAL_GROUPS.has(label));
if (optional.length) {
  indexLines.push('## Optional', '');
  for (const label of optional) {
    const section = sections.get(label);
    indexLines.push(`### ${label}`, '', ...section.intro, '');
    for (const [sub, items] of section.subs) indexLines.push(`#### ${sub}`, '', ...items, '');
  }
}

writeFileSync(OUT_INDEX, `${indexLines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);

// --- public/llms-full.txt ----------------------------------------------------
const stripDirective = (line) => {
  const m = /^:::([A-Za-z]+)(?:\[([^\]]*)\])?\s*$/.exec(line);
  if (!m) return line;
  const kind = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const title = m[2]?.trim();
  return title ? `**${kind} — ${title}**` : `**${kind}**`;
};

/**
 * Turn MDX into plain Markdown: no frontmatter, no imports, no JSX.
 *
 * Prose outside code fences is unwrapped — a component container (`<CardGrid>`,
 * `<Card title="x">`) becomes plain content dedented to its own level, a Card
 * title becomes a bold lead-in, self-closing components and `import` lines are
 * dropped, and aside directives become bold labels. Fenced code is copied
 * verbatim: plugin examples legitimately contain imports and JSX.
 */
function cleanBody(body) {
  const out = [];
  const stack = []; // open JSX containers: { name, indent, lines }
  const emit = (line) => (stack.length ? stack.at(-1).lines : out).push(line);
  let fence = null;

  const closeContainer = () => {
    if (!stack.length) return;
    const frame = stack.pop();
    const filled = frame.lines.filter((l) => l.trim() !== '');
    const indent = filled.length ? Math.min(...filled.map((l) => /^[ \t]*/.exec(l)[0].length)) : 0;
    const target = stack.length ? stack.at(-1).lines : out;
    if (frame.title) target.push('', `**${frame.title}**`, '');
    for (const line of frame.lines) {
      target.push(line.trim() === '' ? '' : line.slice(Math.min(indent, /^[ \t]*/.exec(line)[0].length)));
    }
  };

  for (const raw of body.split('\n')) {
    const ticks = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (ticks) {
      if (!fence) fence = ticks[1][0];
      else if (ticks[1][0] === fence) fence = null;
      emit(raw);
      continue;
    }
    if (fence) { emit(raw); continue; } // code samples are verbatim

    if (/^\s*import\s[\s\S]*from\s+['"][^'"]+['"];?\s*$/.test(raw)) continue;
    if (/^\s*export\s+(const|default|function)\s/.test(raw)) continue;
    if (/^\s*:::\s*$/.test(raw)) continue; // closing aside

    const line = raw.replace(/^\s*:::/, ':::');
    if (/^:::/.test(line)) {
      emit(stripDirective(line));
      continue;
    }

    const openTag = /^([ \t]*)<([A-Z][\w.]*)((?:\s[^<>]*)?)>\s*$/.exec(raw);
    const closeTag = /^[ \t]*<\/([A-Z][\w.]*)>\s*$/.exec(raw);
    if (openTag) {
      const [, indent, name, attrs] = openTag;
      const title = /\btitle=["']([^"']+)["']/.exec(attrs)?.[1];
      stack.push({ name, indent: indent.length, title, lines: [] });
      continue;
    }
    if (closeTag) { closeContainer(); continue; }
    if (/^[ \t]*<[A-Z][\w.]*(\s[^<>]*)?\/>\s*$/.test(raw)) continue; // self-closing component

    // Inline components in prose lose their tags but keep their text.
    emit(raw.replace(/<\/?[A-Z][\w.]*(\s[^<>]*)?\/?>/g, ''));
  }
  while (stack.length) closeContainer();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const pageOrder = [];
const push = (page) => {
  if (page && !pageOrder.includes(page)) pageOrder.push(page);
};
push(bySlug.get('index'));
for (const item of sidebar) if (item.slug) push(bySlug.get(item.slug));
for (const page of docs.slice().sort((a, b) => a.slug.localeCompare(b.slug))) push(page);

const latest = docs.map((d) => d.lastVerified).filter(Boolean).sort().at(-1) ?? 'unknown';
const full = [
  '# Catalyst Docs — Full Documentation',
  '',
  '> Every Catalyst documentation page as plain Markdown, in reading order.',
  '> Source: the docs repository (src/content/docs). Frontmatter is rendered as',
  '> plain fields, MDX imports and components are removed, code samples are',
  '> verbatim. Canonical URLs point at docs.catalystctl.com.',
  '',
  `Site: ${SITE}/`,
  `Index: ${SITE}/llms.txt`,
  `API contract: ${SITE}/openapi.json`,
  `Latest page verification: ${latest}`,
  `Pages: ${pageOrder.length}`,
  '',
];

for (const page of pageOrder) {
  const meta = [
    `URL: ${page.url}`,
    page.audience.length ? `Audience: ${page.audience.join(', ')}` : null,
    page.lastVerified ? `Last verified: ${page.lastVerified}` : null,
  ].filter(Boolean);
  full.push('---', '', `# ${page.title ?? page.slug}`, '', ...meta, '', cleanBody(page.body), '');
}

writeFileSync(OUT_FULL, `${full.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);

console.log(`generate-llms: ${pageOrder.length} page(s) → public/llms.txt, public/llms-full.txt`);
