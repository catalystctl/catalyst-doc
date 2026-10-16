# catalyst-doc — Catalyst product documentation

The production docs site for Catalyst, served at
**[docs.catalystctl.com](https://docs.catalystctl.com)** via Cloudflare Pages.

- **Site:** Astro + Starlight, static-first (`src/content/docs/`).
- **Audiences:** game-server owners (`users/`), operators (`admin/`),
  API consumers (`api/`), plus `getting-started/`, `troubleshooting/`,
  `contributing/`.
- **API reference:** generated from the Catalyst backend
  (`api/openapi.json`, rendered with Scalar) — never hand-edited.
- **Docs agent:** `tools/docs-agent/` keeps pages synchronized with the
  `catalystctl/catalyst` codebase.
- **Relation to Catalyst:** standalone companion to `catalystctl/catalyst`
  (not a submodule). Clone it next to the product checkout and point the
  docs agent at both with `--source-repo/--docs-repo`.

## Local development

```bash
pnpm install
pnpm dev            # http://localhost:4321
pnpm validate       # links, slugs, frontmatter, assets, OpenAPI, terminology
pnpm test           # docs-agent tests
pnpm run build      # production build (same command Cloudflare Pages runs)
pnpm preview        # serve the production output
```

## Repository structure

```text
astro.config.mjs      Starlight config — NESTED sidebar (group → subgroup → page)
src/content/docs/     69 pages, one folder per audience:
  getting-started/      4  what Catalyst is, terminology, first server
  users/               17  the Game Server Guide (incl. account.mdx)
  admin/               22  the Administrator Guide (incl. plugins.mdx)
  api/                 18  REST API, realtime, plugin development, reference
  troubleshooting/      7  symptom-driven fixes
  contributing/         1  this docs contributor guide
  index.mdx               splash page
src/assets/ src/styles/  logo, Catalyst-themed Starlight CSS
public/               static files (openapi.json served copy lands here)
api/openapi.json      committed API contract (generated — see below)
scripts/              sync-openapi.mjs, validate-docs.mjs, check-terminology.mjs
tools/docs-agent/     docs-maintenance agent (audit/diff/feature/validate/api)
.github/workflows/    docs-ci.yml (validate+test+build), api-sync.yml
DEPLOYMENT.md         Cloudflare Pages setup (docs.catalystctl.com)
AGENTS.md             contributor/agent conventions
terminology.json      canonical product vocabulary
```

## Edit docs

Pages live under `src/content/docs/`, one folder per audience. Every page
except the splash `index.mdx` carries frontmatter (`title`, `description`,
`audience`, `features`, `sources`, `last_verified`). A new page also needs a
sidebar entry in `astro.config.mjs`; the sidebar is nested (`items:` groups to
arbitrary depth) and nesting does not change URLs. Two recent additions:
`admin/plugins` and `users/account`.

Run the gates before pushing:

```bash
pnpm validate            # links, slugs, frontmatter, assets, OpenAPI, terminology
pnpm check-terminology   # banned + preferred vocabulary only
pnpm test                # docs-agent unit tests
```

`pnpm validate` (i.e. `node scripts/validate-docs.mjs`) is the fastest gate;
`pnpm run build` is the command Cloudflare Pages runs. Full conventions:
`AGENTS.md` and the [docs contributor guide](https://docs.catalystctl.com/contributing/docs/).

## API reference generation

```bash
# From a Catalyst checkout (regenerates api/openapi.json + served copy):
pnpm sync-openapi --from-checkout ../catalyst
# Copy committed artifact to the served location:
pnpm sync-openapi
```

The exporter itself lives in the Catalyst repo:
`catalyst-backend/scripts/export-openapi.ts` (`pnpm --filter catalyst-backend run openapi:export`).

## Docs agent

```bash
pnpm docs-agent audit --source-repo ../catalyst --docs-repo .
pnpm docs-agent diff --source-repo ../catalyst --base origin/main --head HEAD --dry-run
```

Details: `tools/docs-agent/README.md`.

## Deployment

Push to `main` → Cloudflare Pages builds (`pnpm run build`, output `dist/`)
and deploys `docs.catalystctl.com`. PRs get preview deployments. Setup:
`DEPLOYMENT.md`.

## Remote

- Remote: `https://github.com/catalystctl/catalyst-doc`
- Standalone repo by design (not a Catalyst submodule): clone it next to the
  product checkout (`../catalyst`) so docs and product rev independently.
  Update docs via normal PRs here; no pointer bumps needed anywhere.
