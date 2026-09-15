#!/usr/bin/env node
/**
 * sync-openapi.mjs — bring the authoritative Catalyst API contract into the docs site.
 *
 * Modes:
 *   node scripts/sync-openapi.mjs
 *     Copy api/openapi.json (committed artifact) to public/openapi.json
 *     so the site and the Scalar viewer can serve it.
 *
 *   node scripts/sync-openapi.mjs --from-checkout /path/to/catalyst
 *     Regenerate api/openapi.json from a Catalyst checkout by running that
 *     repo's `openapi:export` script, then copy it to public/.
 *
 *   node scripts/sync-openapi.mjs --check
 *     Exit non-zero when public/openapi.json differs from api/openapi.json
 *     (used by validation/CI to catch a stale served copy).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'api/openapi.json');
const served = resolve(root, 'public/openapi.json');
const args = process.argv.slice(2);

function regenerate(checkout) {
  const pkg = resolve(checkout, 'catalyst-backend/package.json');
  if (!existsSync(pkg)) {
    console.error(`sync-openapi: no catalyst-backend at ${checkout}`);
    process.exit(1);
  }
  console.log(`sync-openapi: exporting from ${checkout}`);
  execFileSync('pnpm', ['--filter', 'catalyst-backend', 'run', 'openapi:export', '--out', source], {
    cwd: checkout,
    stdio: 'inherit',
  });
}

if (args.includes('--from-checkout')) {
  const checkout = args[args.indexOf('--from-checkout') + 1];
  if (!checkout) {
    console.error('sync-openapi: --from-checkout needs a path to the catalyst checkout');
    process.exit(1);
  }
  regenerate(resolve(checkout));
}

if (!existsSync(source)) {
  console.error('sync-openapi: api/openapi.json is missing — regenerate with --from-checkout <catalyst-repo>');
  process.exit(1);
}

// The committed artifact must always be valid JSON with the expected shape.
const doc = JSON.parse(readFileSync(source, 'utf-8'));
if (doc.openapi !== '3.1.0' || typeof doc.paths !== 'object' || typeof doc.info !== 'object') {
  console.error('sync-openapi: api/openapi.json is not a valid OpenAPI 3.1 document');
  process.exit(1);
}
const ops = Object.values(doc.paths).reduce((n, v) => n + Object.keys(v).length, 0);

if (args.includes('--check')) {
  if (!existsSync(served) || readFileSync(served, 'utf-8') !== readFileSync(source, 'utf-8')) {
    console.error('sync-openapi: public/openapi.json is stale — run `pnpm sync-openapi`');
    process.exit(1);
  }
  console.log(`sync-openapi: served copy is current (${ops} operations)`);
  process.exit(0);
}

mkdirSync(dirname(served), { recursive: true });
copyFileSync(source, served);
console.log(`sync-openapi: ${ops} operations → public/openapi.json`);
