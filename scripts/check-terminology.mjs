#!/usr/bin/env node
/**
 * check-terminology.mjs — enforce canonical Catalyst vocabulary in docs.
 * Reads terminology.json; fails on banned phrases, warns on nothing.
 * Case-insensitive prose scan; code blocks and inline code are skipped so
 * endpoint names and identifiers never trip the linter.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const terms = JSON.parse(readFileSync(resolve(root, 'terminology.json'), 'utf-8'));

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const full = resolve(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(md|mdx)$/.test(e)) out.push(full);
  }
  return out;
}

const stripCode = (src) =>
  src.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');

let failures = 0;
for (const file of walk(resolve(root, 'src/content/docs'))) {
  const rel = file.slice(root.length + 1);
  const prose = stripCode(readFileSync(file, 'utf-8'));
  for (const [phrase, reason] of Object.entries(terms.banned)) {
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(prose)) {
      console.error(`FAIL  ${rel}: banned phrase '${phrase}' — ${reason}`);
      failures++;
    }
  }
}
if (failures === 0) console.log('ok    terminology: no banned phrases');
else console.log(`\ncheck-terminology: ${failures} failure(s)`);
process.exit(failures > 0 ? 1 : 0);
