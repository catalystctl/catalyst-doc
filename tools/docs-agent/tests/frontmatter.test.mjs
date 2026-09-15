import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, globMatch, pagesForPath } from '../lib/frontmatter.mjs';

describe('frontmatter metadata', () => {
  it('parses audience/features/sources lists', () => {
    const fm = parseFrontmatter(`---
title: Creating Backups
audience:
  - user
features:
  - backups
sources:
  - catalyst-backend/src/routes/backups.ts
last_verified: '2026-09-15'
---
Body`);
    assert.equal(fm.title, 'Creating Backups');
    assert.deepEqual(fm.audience, ['user']);
    assert.deepEqual(fm.features, ['backups']);
    assert.deepEqual(fm.sources, ['catalyst-backend/src/routes/backups.ts']);
    assert.equal(fm.last_verified, '2026-09-15');
  });

  it('matches ** globs for source mapping', () => {
    assert.ok(globMatch('catalyst-backend/src/routes/**', 'catalyst-backend/src/routes/nodes.ts'));
    assert.ok(!globMatch('catalyst-backend/src/routes/*.ts', 'catalyst-backend/src/routes/servers/core.ts'));
    assert.ok(globMatch('catalyst-frontend/src/pages/servers/', 'catalyst-frontend/src/pages/servers/'));
  });

  it('maps a changed path to declaring pages', () => {
    const pages = [
      { rel: 'users/backups.mdx', meta: { sources: ['catalyst-backend/src/routes/backups.ts'] } },
      { rel: 'admin/overview.mdx', meta: { sources: ['install.sh'] } },
    ];
    const hit = pagesForPath(pages, 'catalyst-backend/src/routes/backups.ts');
    assert.equal(hit.length, 1);
    assert.equal(hit[0].rel, 'users/backups.mdx');
  });
});
