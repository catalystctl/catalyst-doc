# AGENTS.md — catalyst-doc contributor instructions

Docs are a product. Every page must help someone use, operate, administer,
troubleshoot, or integrate with Catalyst. This is NOT an architecture wiki:
no code-structure tours, no service-call narratives, no internals unless an
admin needs them to fix something.

## What belongs here vs. in `catalyst`

- **Here:** user tasks, admin procedures, API guides + generated reference,
  troubleshooting, install/update/migrate/disaster-recovery, docs tooling.
- **In `catalyst`:** contributor setup, architecture, ADRs, internal module
  notes, security implementation details, test strategy, agent instructions.

## Audiences (one page, one primary audience)

- `user` — server owners. Task steps, no architecture.
- `admin` — operators. Procedures with prerequisites + verification.
- `developer` — API consumers. Precise contracts, no invented fields.

## Writing conventions

- Direct, task-oriented, numbered steps. Prerequisites first. Destructive
  actions get `::: caution` blocks.
- Terminology follows `terminology.json` (`panel`, `node`, `server`,
  `template`, `allocation`, `task`, `subuser`, `API key`). Never call a
  Catalyst server a Pterodactyl server; never call scheduled actions cron jobs.
- No invented facts: flags, ports, defaults, permissions, and API fields come
  from source/config/schema. When unsure, flag it — do not fabricate.
- Frontmatter on every page except the splash index: `title`, `description`,
  `audience`, `features`, `sources` (code paths this page documents, used by
  the docs agent), `last_verified` (YYYY-MM-DD, bump when you verify content
  against the code).
- Links: prefer absolute docs paths (`/users/backups/`). Every internal link
  must resolve — CI fails otherwise.

## Information architecture

- `getting-started/` → `users/` → `admin/` → `api/` → `troubleshooting/` →
  `contributing/`. New pages go under the audience folder; sidebar entries in
  `astro.config.mjs` must match (CI checks).
- API guides are hand-written concepts; the endpoint reference is generated
  (`api/openapi.json` + Scalar). Never hand-edit the generated artifact.

## Screenshots

- The docs site is intentionally screenshot-free for now: screenshots rot fast
  and every one is a maintenance liability.
- Product screenshots for the main README live in `catalystctl/catalyst`
  under `docs/screenshots/` (with `manifest.json`).
- If screenshots become necessary here, generate them with Playwright against
  a deterministic test environment (seeded data, fixed viewport), store
  sources under `screenshots/`, and never commit hand-taken screenshots.
  Keep them to flows where an image materially beats words (first setup,
  console layout) — not every page.

## Validation (run before every PR)

```bash
pnpm validate && pnpm test && pnpm run build
```

Keep CI green and quiet: no noisy checks, no checks that get disabled.

## Docs agent

Use `tools/docs-agent/` for sync work across the Catalyst checkout
(`audit`/`diff`/`feature`/`validate`/`api`). Review its diffs like a human
author's — it appends marked notes, never rewrites pages wholesale.
