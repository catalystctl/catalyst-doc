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

## Audiences

`audience` is a list, and the **first** entry is the **primary** audience —
the reader the page is written for. Additional audiences are allowed only
where the page genuinely serves them (a shared task or failure mode); do not
pad the list, and declare each audience at most once.

- `user` — server owners. Task steps, no architecture.
- `admin` — operators. Procedures with prerequisites + verification.
- `developer` — API consumers. Precise contracts, no invented fields.

`scripts/validate-docs.mjs` rejects an empty `audience` list, any value
outside this set, and a value declared twice.

## Frontmatter contract

Every page except the splash `index.mdx` must carry all six fields, and
`scripts/validate-docs.mjs` hard-fails when any is missing or malformed:

| Field | Required check |
|-------|----------------|
| `title` | Present. Keep it textually identical to the sidebar label. |
| `description` | Present. One line saying what the page teaches. |
| `audience` | Non-empty list of `user`/`admin`/`developer`, no duplicates; first entry is primary. |
| `features` | Non-empty, and every tag from the canonical vocabulary (below). |
| `sources` | Non-empty list of repo paths/globs this page documents. |
| `last_verified` | `YYYY-MM-DD`; bump only when re-verified against source. |

`api_tags` is **not** part of the frontmatter contract — do not add it. It was
never documented and is being removed; `features` is the only classification
field.

## Writing conventions

- Direct, task-oriented, numbered steps. Prerequisites first. Destructive
  actions get `::: caution` blocks.
- Asides use the Starlight directive syntax with **no space** after `:::`, and
  an optional title on the same line: `:::note[Title]`. A spaced directive
  (`::: note`) renders literally and now fails `scripts/validate-docs.mjs`.
  The valid kinds are `note`, `tip`, `caution` and `danger`.
- Terminology follows `terminology.json` (`panel`, `node`, `server`,
  `template`, `allocation`, `task`, `subuser`, `API key`). Never call a
  Catalyst server a Pterodactyl server, a container, or an instance —
  *container* only means the Docker/OCI runtime object that runs the server.
  Never call scheduled actions cron jobs, or a task a schedule.
- `scripts/check-terminology.mjs` enforces this. Banned phrases are hard
  failures (plurals and possessives included); a banned phrase inside a quoted
  UI label (`**Sub-users**`) is allowed, because the panel's own wording must
  be reproduced verbatim. The `preferred` rules for `server`/`task` are
  conservative: on pages whose audience includes `user` but not `developer`,
  *instance*/*container* as a server synonym fails unless the context is the
  OCI runtime (container image, the container runtime, docker container, …),
  and *schedule* as a noun for a task warns rather than fails. Admin pages are
  excluded from the `schedule` rule — the backup/retention schedule is a
  timing rule, not a task. Do not add bare `container`, `instance` or
  `schedule` to the banned list: banned entries are matched whole-word over
  prose and would fire on legitimate Docker/OCI uses.
- No invented facts: flags, ports, defaults, permissions, and API fields come
  from source/config/schema. When unsure, flag it — do not fabricate.
- Links: prefer absolute docs paths (`/users/backups/`). Every internal link
  must resolve — CI fails otherwise.

## Information architecture

- Audience folders, in reading order: `getting-started/` → `users/` →
  `admin/` → `api/` → `troubleshooting/` → `contributing/`. A new page goes
  under the audience folder that owns it **and** gets a sidebar entry.
- The sidebar in `astro.config.mjs` is **nested** (Starlight `items:`), not a
  flat list: every top-level entry is a group with `items`, and groups nest to
  arbitrary depth (the shipped tree is three levels — group → subgroup → page,
  e.g. the `Nodes` subgroup inside the Administrator Guide). Nesting changes
  navigation only; URLs still follow the content path, so
  `admin/nodes/overview.mdx` stays at `/admin/nodes/overview/`.
- `scripts/validate-docs.mjs` check 1 fails when a sidebar `slug` has no page.
  A page with no sidebar entry is an orphan: a warning today, a failure under
  `--strict`. Keep every page reachable, and keep the sidebar label textually
  identical to the page `title`.
- `features` uses the canonical 30-tag vocabulary below. `validate-docs.mjs`
  hard-fails any tag outside this set, and `tools/docs-agent/lib/classify.mjs`
  matches these exact tags when it maps changed code paths to pages — an
  invented tag would also drop the page out of change→docs mapping, so never
  invent one.

  ```text
  getting-started     installation        configuration      administration
  users-and-access    permissions         security           nodes
  servers             console             files              sftp
  backups             databases           networking         tasks
  mods-and-plugins    monitoring          storage            templates
  updates             migration           disaster-recovery  api
  api-auth            api-errors          websockets         plugin-development
  troubleshooting     contributing
  ```

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
