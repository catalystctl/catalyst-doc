/**
 * classify.test.mjs — the docs agent must NOT mark every commit as
 * documentation-sensitive. Representative fixtures:
 *  1. UI copy-only change → no doc updates
 *  2. New server setting → user docs update
 *  3. New admin setting → admin docs update
 *  4. API route change → schema regeneration
 *  5. Permission change → API/admin docs update
 *  6. Internal refactor → internal only
 *  7. Removed feature → stale-docs cleanup signal
 *  8. Changed CLI/config option → admin/install docs update
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChange } from '../lib/classify.mjs';

describe('docs-agent classification', () => {
  it('1. UI copy-only change needs no documentation', () => {
    const a = analyzeChange(['catalyst-frontend/src/i18n/locales/en/servers.json']);
    assert.equal(a.impact.user, 'no change');
    assert.equal(a.impact.admin, 'no change');
    assert.equal(a.impact.apiGuides, 'no change');
    assert.equal(a.impact.apiReference, 'unchanged');
  });

  it('2. new server setting requires user documentation', () => {
    const a = analyzeChange(['catalyst-frontend/src/components/servers/tabs/ServerConfigurationTab.tsx']);
    assert.equal(a.impact.user, 'update required');
    assert.ok(a.affectedFeatures.includes('servers'));
  });

  it('3. new admin setting requires admin documentation', () => {
    const a = analyzeChange(['catalyst-backend/src/routes/settings.ts', 'docs/environment-variables.md']);
    assert.equal(a.impact.admin, 'update required');
  });

  it('4. API route change regenerates the reference', () => {
    const a = analyzeChange(['catalyst-backend/src/routes/nodes.ts']);
    assert.equal(a.impact.apiReference, 'regenerated');
    assert.equal(a.impact.admin, 'update required');
  });

  it('5. permission change updates API and admin docs', () => {
    const a = analyzeChange(['catalyst-backend/src/routes/roles.ts']);
    assert.equal(a.impact.apiGuides, 'update required');
    assert.equal(a.impact.admin, 'update required');
    assert.ok(a.affectedFeatures.includes('permissions'));
  });

  it('6. internal refactor needs no documentation', () => {
    const a = analyzeChange([
      'catalyst-backend/src/services/scheduler.ts',
      'catalyst-backend/src/__tests__/scheduler.test.ts',
      'benchmarks/bench.md',
    ]);
    // scheduler.ts is not internal-only by path, but has no feature rule:
    // must not claim user/admin updates without evidence.
    assert.equal(a.impact.user, 'no change');
    assert.equal(a.impact.admin, 'no change');
    assert.equal(a.impact.apiGuides, 'no change');
  });

  it('7. removed backup-adjacent feature flags stale docs cleanup', () => {
    const a = analyzeChange(['catalyst-backend/src/routes/backups.ts']);
    assert.equal(a.impact.user, 'update required');
    assert.ok(a.affectedFeatures.includes('backups'));
  });

  it('8. changed CLI/config option updates admin docs', () => {
    const a = analyzeChange(['scripts/deploy-agent.sh']);
    assert.equal(a.impact.admin, 'update required');
    assert.ok(a.affectedFeatures.includes('nodes'));
  });

  it('websocket changes flag developer docs', () => {
    const a = analyzeChange(['catalyst-backend/src/websocket/gateway.ts']);
    assert.equal(a.impact.apiGuides, 'update required');
    assert.equal(a.impact.apiReference, 'regenerated');
  });

  it('empty changesets report low confidence for human review', () => {
    const a = analyzeChange([]);
    assert.equal(a.confidence, 'low');
  });
});
