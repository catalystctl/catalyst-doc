#!/usr/bin/env node
/**
 * check-terminology.mjs — enforce canonical Catalyst vocabulary in docs.
 *
 * Reads terminology.json and applies two layers:
 *
 *  banned phrases (terminology.json `banned`) — hard failures. Plural and
 *  possessive forms are caught too ('sub-users', 'cron jobs'). When the match
 *  is a quoted UI label (**...** or "...") it is downgraded to a warning,
 *  because docs must quote the panel's own label verbatim.
 *
 *  preferred terms (terminology.json `preferred`) — the highest-value rules
 *  only, kept conservative so they never fire on legitimate prose:
 *   * `server` — on pages whose audience includes `user` (and not
 *     `developer`), 'instance(s)'/'container(s)' used as a synonym for a
 *     Catalyst server is a failure. Matches inside inline code/fenced blocks
 *     and legitimate OCI/runtime phrases ('container image', 'the container
 *     runtime', 'unprivileged container', …) are skipped.
 *   * `task` — on user-facing pages, 'schedule' used as a noun for a task
 *     ('the schedule', 'a schedule') is reported. The verb and 'scheduled'
 *     are correct, and the idiomatic recurrence ('on a schedule') is not a
 *     task synonym. Admin pages are excluded: they legitimately describe the
 *     backup/retention schedule, which is a timing rule, not a server task.
 *     This rule warns rather than fails — the noun/task distinction is
 *     heuristic and a false positive must not break the build.
 *
 * Code spans, fenced blocks and the frontmatter `sources:` paths are stripped
 * so identifiers and file paths never trip the linter.
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

// Prose only: drop fenced blocks and inline code.
const stripCode = (src) =>
  src.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');

// The frontmatter `sources:` list holds code paths, not prose — a path such as
// `.../apikeys/...` must not be read as the banned word 'apikey'.
const stripSources = (src) =>
  src.replace(/^sources:[^\n]*\n(?:[ \t]+-[^\n]*\n?)*/m, '');

const audienceOf = (src) => {
  const m = src.match(/^audience:\s*\n((?:[ \t]+-[^\n]*\n?)+)/m);
  return m ? [...m[1].matchAll(/-\s+(\S+)/g)].map((x) => x[1]) : [];
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let failures = 0;
let warnings = 0;
const fail = (msg) => { console.error(`FAIL  ${msg}`); failures++; };
const warn = (msg) => { console.log(`WARN  ${msg}`); warnings++; };

for (const file of walk(resolve(root, 'src/content/docs'))) {
  const rel = file.slice(root.length + 1);
  const raw = readFileSync(file, 'utf-8');
  const prose = stripCode(stripSources(raw));
  const audience = audienceOf(raw);

  // --- banned phrases --------------------------------------------------------
  for (const [phrase, reason] of Object.entries(terms.banned)) {
    const base = escapeRe(phrase);
    if (new RegExp(`\\b${base}\\b`, 'i').test(prose)) {
      fail(`${rel}: banned phrase '${phrase}' — ${reason}`);
    }
    // Plural / possessive forms of the same phrase ('cron jobs', "sub-user's").
    // A bolded/quoted UI label is the panel's own wording ("**Sub-users**");
    // docs must reproduce it verbatim, so it is allowed rather than flagged.
    const pluralRe = new RegExp(`\\b${base}(?:s|['’]s)\\b`, 'gi');
    for (const m of prose.matchAll(pluralRe)) {
      const before = prose.slice(Math.max(0, m.index - 2), m.index);
      const after = prose.slice(m.index + m[0].length, m.index + m[0].length + 2);
      const quoted = /^(?:\*\*|["'“”])$/.test(before) && /^(?:\*\*|["'“”])$/.test(after);
      if (quoted) continue;
      fail(`${rel}: banned phrase '${m[0]}' — ${reason}`);
    }
  }

  // --- preferred: 'server' ---------------------------------------------------
  // terminology.json: "Never 'container' or 'instance' in user docs."
  // Only user-audience pages, and only when they do not also target developers
  // (API pages discuss containers/instances legitimately). A determiner right
  // before the word is the synonym signal; runtime phrases are skipped.
  if (audience.includes('user') && !audience.includes('developer')) {
    const SYNONYM = /\b(?:the|a|an|your|our|its|their|each|every|this|that|these|those|one|two|multiple|new|existing|running|stopped|same|different|any|no|separate|individual)\s+[*_]*\b(instances?|containers?)\b/gi;
    for (const m of prose.matchAll(SYNONYM)) {
      const after = prose.slice(m.index + m[0].length, m.index + m[0].length + 24);
      const before = prose.slice(Math.max(0, m.index - 30), m.index);
      // Legitimate OCI/runtime contexts: 'container image', 'the container
      // runtime', 'docker container', 'unprivileged container', …
      const runtimeAfter = /^\s*[*_]*\s*(?:port|section|image|runtime|logs?|name|id|registry|engine|network|environment|filesystem|storage|host|users?|command|orchestration|lifecycle|isolation|health|metrics|limits?|layer|build|start|stop|restart)\b/i.test(after);
      const runtimeBefore = /(?:docker|podman|oci|lxc|privileged|unprivileged|backend|frontend|postgres(?:ql)?|redis|panel|node|compose|containerd)\s*[*_]*\s*$/i.test(before);
      if (runtimeAfter || runtimeBefore) continue;
      fail(`${rel}: '${m[0].trim()}' uses '${m[1].toLowerCase()}' for a Catalyst server — say 'server' (terminology.json preferred)`);
    }
  }

  // --- preferred: 'task' -----------------------------------------------------
  // terminology.json: "Never 'cron job' or 'schedule' as a noun for it."
  // The verb ('schedule a restart') and 'scheduled' are correct. 'on a/the
  // schedule' is an idiomatic recurrence, not a task, so it is skipped. Only
  // user-facing pages are checked: admin pages legitimately describe the
  // backup/retention schedule, which is a timing rule rather than a task. The
  // remaining noun uses are reported as warnings: telling a Task apart from a
  // generic backup/retention schedule is heuristic, and this must not fail CI.
  if (audience.includes('user') && !audience.includes('developer')) {
    const SCHEDULE_NOUN = /\b(?:the|a|an|your|our|its|their|this|that|each|every|any|no|one|another|separate)\s+[*_]*schedule\b/gi;
    for (const m of prose.matchAll(SCHEDULE_NOUN)) {
      const before = prose.slice(Math.max(0, m.index - 4), m.index);
      if (/\bon\s+$/i.test(before)) continue; // 'on a schedule' — recurrence, not a task
      warn(`${rel}: '${m[0].trim()}' looks like 'schedule' as a noun for a task — prefer 'task' (terminology.json preferred)`);
    }
  }
}

if (failures === 0) {
  console.log(`ok    terminology: no banned phrases or preferred-term violations${warnings ? ` (${warnings} warning(s))` : ''}`);
} else {
  console.log(`\ncheck-terminology: ${failures} failure(s), ${warnings} warning(s)`);
}
process.exit(failures > 0 ? 1 : 0);
