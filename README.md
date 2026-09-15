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
- **Relation to Catalyst:** this repo is also consumed as the `catalyst-doc`
  git submodule inside `catalystctl/catalyst`.

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
src/content/docs/     Markdown/MDX pages by audience
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

Pages live under `src/content/docs/` with frontmatter (`title`, `description`,
`audience`, `features`, `sources`, `last_verified`). Full conventions:
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

## Remote / submodule

- Remote: `https://github.com/catalystctl/catalyst-doc`
- Consumed by Catalyst as `./catalyst-doc` submodule. Clone with
  `git clone --recurse-submodules`, update docs via normal PRs here, and bump
  the submodule pointer in the Catalyst repo to adopt a new revision.
