/**
 * repo.mjs — small git/file helpers. Read-only except where callers write docs.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' }).trim();
}

export function changedFiles(repo, base, head) {
  try {
    const out = git(repo, 'diff', '--name-only', `${base}..${head}`);
    return out ? out.split('\n').filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function diffStat(repo, base, head, limit = 400) {
  try {
    return git(repo, 'diff', '--stat', `${base}..${head}`).split('\n').slice(0, limit).join('\n');
  } catch {
    return '';
  }
}

export function fileAt(repo, rev, path, maxBytes = 200_000) {
  try {
    const out = execFileSync('git', ['-C', repo, 'show', `${rev}:${path}`], {
      encoding: 'utf-8',
      maxBuffer: maxBytes,
    });
    return out.slice(0, maxBytes);
  } catch {
    return null;
  }
}

export function walkDocs(docsDir) {
  const out = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir)) {
      const full = resolve(dir, e);
      if (statSync(full).isDirectory()) walk(full, `${rel}${e}/`);
      else if (/\.(md|mdx)$/.test(e)) out.push(`${rel}${e}`);
    }
  };
  if (existsSync(docsDir)) walk(docsDir, '');
  return out;
}

export function readText(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}
