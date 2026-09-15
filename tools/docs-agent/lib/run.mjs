/**
 * run.mjs — the five docs-agent modes.
 *
 * audit:     walk every docs page; check its `sources` still exist in the
 *            source repo, its `last_verified` freshness, and report gaps.
 * diff:      classify BASE..HEAD, map to pages via frontmatter sources +
 *            heuristics, optionally draft edits with the LLM, write to the
 *            working tree (no commit) unless --dry-run.
 * feature:   same as diff but scoped: pages/features matching --feature.
 * validate:  read-only consistency report (frontmatter + link hints).
 * api:       re-run the OpenAPI export from the source checkout and report
 *            which tags/endpoints changed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeChange, formatReport } from './classify.mjs';
import { parseFrontmatter, pagesForPath } from './frontmatter.mjs';
import { changedFiles, diffStat, git, readText, walkDocs } from './repo.mjs';
import { available, draft, providerInfo } from './llm.mjs';
import { SYSTEM_PROMPT, diffPrompt } from './prompts.mjs';

function resolveRepos(opts) {
  const docsRepo = resolve(opts.docsRepo ?? new URL('../..', import.meta.url).pathname);
  const guess = resolve(docsRepo, '..', 'catalyst');
  const sourceRepo = resolve(opts.sourceRepo ?? guess);
  if (!existsSync(resolve(docsRepo, 'astro.config.mjs'))) throw new Error(`docs repo not found at ${docsRepo}`);
  return { docsRepo, sourceRepo, sourcePresent: existsSync(resolve(sourceRepo, 'catalyst-backend/package.json')) };
}

function loadPages(docsRepo) {
  const dir = resolve(docsRepo, 'src/content/docs');
  return walkDocs(dir).map((rel) => ({
    rel,
    path: resolve(dir, rel),
    meta: parseFrontmatter(readText(resolve(dir, rel)) ?? ''),
  }));
}

function emit(report, asJson, payload) {
  if (asJson) console.log(JSON.stringify(payload, null, 2));
  else console.log(report);
}

export async function run(mode, opts) {
  const { docsRepo, sourceRepo, sourcePresent } = resolveRepos(opts);
  const pages = loadPages(docsRepo);

  if (mode === 'validate') {
    const missing = pages.filter((p) => !p.meta.title || !p.meta.description || (p.rel !== 'index.mdx' && !p.meta.audience?.length));
    const report = `Docs validation: ${pages.length} pages, ${missing.length} with metadata gaps${missing.length ? `\n- ${missing.map((p) => p.rel).join('\n- ')}` : ''}`;
    return emit(report, opts.json, { mode, pages: pages.length, gaps: missing.map((p) => p.rel) });
  }

  if (mode === 'audit') {
    // Every page whose declared sources vanished, or whose verification is stale.
    const staleCutoff = new Date();
    staleCutoff.setMonth(staleCutoff.getMonth() - 6);
    const findings = [];
    for (const p of pages) {
      if (p.rel === 'index.mdx') continue;
      for (const pat of p.meta.sources ?? []) {
        const prefix = pat.split('*')[0].replace(/\/$/, '');
        // Sources may live in either checkout (product code vs. docs tooling).
        if (prefix && sourcePresent && !existsSync(resolve(sourceRepo, prefix)) && !existsSync(resolve(docsRepo, prefix))) {
          findings.push({ page: p.rel, issue: 'source-gone', detail: `declared source no longer exists: ${pat}` });
        }
      }
      if (p.meta.last_verified && new Date(p.meta.last_verified) < staleCutoff) {
        findings.push({ page: p.rel, issue: 'stale', detail: `last verified ${p.meta.last_verified}` });
      }
      if (!p.meta.sources?.length) findings.push({ page: p.rel, issue: 'unmapped', detail: 'no sources metadata — change mapping is heuristic-only' });
    }
    const report = [
      `Docs audit: ${pages.length} pages, ${findings.length} finding(s) [provider: ${providerInfo().provider}]`,
      ...findings.map((f) => `- ${f.page} [${f.issue}] ${f.detail}`),
    ].join('\n');
    return emit(report, opts.json, { mode, pages: pages.length, findings });
  }

  if (mode === 'api') {
    if (!sourcePresent) throw new Error(`source repo not found at ${sourceRepo} (use --source-repo)`);
    const before = existsSync(resolve(docsRepo, 'api/openapi.json'))
      ? readText(resolve(docsRepo, 'api/openapi.json')) : null;
    execFileSync(process.execPath, [resolve(docsRepo, 'scripts/sync-openapi.mjs'), '--from-checkout', sourceRepo], { stdio: 'inherit' });
    const after = readText(resolve(docsRepo, 'api/openapi.json'));
    let summary = 'API sync: no endpoint changes.';
    if (before !== after && before) {
      const b = JSON.parse(before);
      const a = JSON.parse(after);
      const bOps = new Set(Object.entries(b.paths).flatMap(([p, v]) => Object.keys(v).map((m) => `${m} ${p}`)));
      const aOps = new Set(Object.entries(a.paths).flatMap(([p, v]) => Object.keys(v).map((m) => `${m} ${p}`)));
      const added = [...aOps].filter((o) => !bOps.has(o));
      const removed = [...bOps].filter((o) => !aOps.has(o));
      summary = `API sync: +${added.length} / -${removed.length} operations.`;
      if (added.length) summary += `\nAdded:\n- ${added.join('\n- ')}`;
      if (removed.length) summary += `\nRemoved:\n- ${removed.join('\n- ')}`;
    }
    return emit(summary, opts.json, { mode, summary });
  }

  // diff + feature modes
  if (mode === 'feature' && !opts.feature) throw new Error('feature mode needs --feature <name>');
  if (!sourcePresent) throw new Error(`source repo not found at ${sourceRepo} (use --source-repo)`);

  const files = mode === 'diff' ? changedFiles(sourceRepo, opts.base, opts.head) : [];
  const stat = mode === 'diff' ? diffStat(sourceRepo, opts.base, opts.head) : `feature scope: ${opts.feature}`;
  const analysis = mode === 'diff'
    ? { ...analyzeChange(files), base: opts.base, head: opts.head }
    : { impact: { user: 'review', admin: 'review', apiGuides: 'review', apiReference: 'review', troubleshooting: 'review', migration: 'review', internalOnly: 'no' }, affectedFeatures: [opts.feature], confidence: 'medium', needsHumanReview: true, base: 'worktree', head: 'worktree' };

  // Candidate pages: frontmatter sources match, or feature/audience keyword match.
  let candidates = mode === 'diff'
    ? [...new Map(files.flatMap((f) => pagesForPath(pages, f)).map((p) => [p.rel, p])).values()]
    : [];
  if (mode === 'feature' || candidates.length === 0) {
    const key = (mode === 'feature' ? opts.feature : analysis.affectedFeatures.join(' ')).toLowerCase();
    const kw = candidates.map((p) => p.rel);
    for (const p of pages) {
      if (kw.includes(p.rel)) continue;
      const hay = `${p.rel} ${(p.meta.features ?? []).join(' ')} ${(p.meta.audience ?? []).join(' ')}`.toLowerCase();
      if (key && key.split(/[\s,]+/).some((k) => k && hay.includes(k))) candidates.push(p);
    }
  }

  const head = mode === 'diff' ? git(sourceRepo, 'rev-parse', '--short', opts.head) : opts.feature;
  const report = [
    formatReport(analysis, {
      sourceFiles: files,
      pagesExamined: candidates.map((p) => p.rel),
      pagesChanged: [],
      reason: mode === 'diff' ? `Catalyst ${opts.base}..${opts.head} (${head})` : `feature scope: ${opts.feature}`,
    }),
    '',
    `Provider: ${providerInfo().provider}`,
  ].join('\n');

  if (available() && candidates.length > 0 && !opts.dryRun) {
    try {
      const raw = await draft(SYSTEM_PROMPT, diffPrompt({ stat, candidatePages: candidates, analysis }));
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        const decisions = JSON.parse(m[0]).decisions ?? [];
        report.split('\n'); // report already printed below; decisions appended
        const acted = [];
        for (const d of decisions) {
          if (d.action === 'edit' && d.newSection) {
            const target = candidates.find((p) => p.rel === d.page);
            if (target) {
              const text = readText(target.path) ?? '';
              // Targeted append under an agent-notes marker; humans review the diff.
              const marker = '\n\n> **Docs-agent note.** ';
              if (!text.includes(marker.trim())) {
                const { writeFileSync } = await import('node:fs');
                writeFileSync(target.path, `${text.trimEnd()}\n${marker}${d.newSection.trim()}\n`);
                acted.push(d.page);
              }
            }
          }
        }
        emit(`${report}\nLLM decisions applied to working tree (uncommitted): ${acted.join(', ') || '(none)'}`, opts.json, { mode, analysis, candidates: candidates.map((p) => p.rel), acted });
        return;
      }
    } catch (err) {
      emit(`${report}\nLLM drafting skipped: ${err.message}`, opts.json, { mode, analysis, candidates: candidates.map((p) => p.rel), llmError: err.message });
      return;
    }
  }
  emit(`${report}${available() ? '' : '\nHeuristic mode: no LLM credentials — prose updates left to humans.'}${opts.dryRun ? '\nDry run: working tree untouched.' : ''}`, opts.json, { mode, analysis, candidates: candidates.map((p) => p.rel) });
}
