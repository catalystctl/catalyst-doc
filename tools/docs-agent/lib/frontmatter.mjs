/**
 * frontmatter.mjs — parse docs metadata (title, audience, features, sources,
 * api_tags, related, last_verified) and match source-repo paths against the
 * `sources` glob lists. This is what makes change→docs mapping deterministic:
 * a page declares the code it documents, so the agent finds candidate pages
 * without asking a model to guess.
 */

export function parseFrontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm = m[1];
  const get = (key) => fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  const list = (key) => {
    const block = fm.match(new RegExp(`^${key}:\\s*\\n((?:\\s+-\\s+.*\\n?)+)`, 'm'));
    if (!block) {
      const inline = get(key);
      if (inline?.startsWith('[')) return inline.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      return [];
    }
    return [...block[1].matchAll(/-\s+(\S[^\n]*)/g)].map((x) => x[1].trim());
  };
  return {
    title: get('title'),
    description: get('description'),
    audience: list('audience'),
    features: list('features'),
    sources: list('sources'),
    api_tags: list('api_tags'),
    related: list('related'),
    last_verified: (get('last_verified') ?? '').replace(/['"]/g, ''),
  };
}

/** Minimal `**`/`*` glob match for `sources` entries (relative paths). */
export function globMatch(pattern, path) {
  const rx = new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '.*')}$`,
  );
  return rx.test(path);
}

export function pagesForPath(pages, changedPath) {
  return pages.filter((p) => (p.meta.sources ?? []).some((pat) => globMatch(pat, changedPath)));
}
