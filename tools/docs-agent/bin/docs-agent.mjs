#!/usr/bin/env node
/**
 * docs-agent — keep Catalyst docs synchronized with the Catalyst codebase.
 *
 * Modes:
 *   audit     whole-repo audit: every docs page vs. current code (finds gaps)
 *   diff      commit-range analysis: BASE..HEAD, the normal CI/PR mode
 *   feature   audit docs for one named feature (e.g. backups, nodes)
 *   validate  consistency check only, no writes
 *   api       regenerate/sync the OpenAPI artifact and report API doc impact
 *
 * The agent works across two checkouts:
 *   --source-repo <path>  Catalyst product repo (default: ../catalyst)
 *   --docs-repo <path>    this docs repo (default: repo root)
 *
 * By default `diff`/`feature` write updated pages into the docs working tree
 * WITHOUT committing, and print a Documentation Impact report for review.
 * Pass --dry-run to change nothing. Never force-pushes, never publishes.
 *
 * LLM providers (optional — without credentials the agent runs in
 * heuristic mode: deterministic classification + validation, prose
 * suggestions left to humans):
 *   OpenAI-compatible:  DOCS_AGENT_BASE_URL + DOCS_AGENT_API_KEY
 *                       (+ DOCS_AGENT_MODEL, default gpt-4o-mini)
 *   Anthropic-compatible: DOCS_AGENT_ANTHROPIC_KEY (+ DOCS_AGENT_ANTHROPIC_MODEL)
 */
import { run } from '../lib/run.mjs';

const args = process.argv.slice(2);
const mode = args.find((a) => !a.startsWith('--'));
const opt = (name, def = undefined) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};

if (!mode || !['audit', 'diff', 'feature', 'validate', 'api'].includes(mode)) {
  console.error('Usage: docs-agent <audit|diff|feature|validate|api> [options]');
  console.error('  --source-repo <path>  --docs-repo <path>');
  console.error('  --base <sha> --head <sha>   (diff mode, default HEAD~1..HEAD)');
  console.error('  --feature <name>            (feature mode)');
  console.error('  --json                      machine-readable report');
  console.error('  --dry-run                   analyze only, write nothing');
  process.exit(2);
}

try {
  await run(mode, {
    sourceRepo: opt('--source-repo'),
    docsRepo: opt('--docs-repo'),
    base: opt('--base', 'HEAD~1'),
    head: opt('--head', 'HEAD'),
    feature: opt('--feature'),
    json: args.includes('--json'),
    dryRun: args.includes('--dry-run'),
  });
} catch (err) {
  console.error(`docs-agent: ${err.message}`);
  process.exit(1);
}
