# Catalyst Docs Agent

Keeps the docs in this repo synchronized with the Catalyst product repo
(`catalystctl/catalyst`). It is a product-documentation maintainer, not a
code explainer: it maps product changes to the user/admin/API/troubleshooting
pages they affect, and proposes minimal task-oriented updates.

Zero dependencies — plain Node 20+ (`fetch` only, no SDKs).

## Usage

```bash
# Normal CI/PR mode: what did BASE..HEAD change for docs? (dry run first)
node tools/docs-agent/bin/docs-agent.mjs diff \
  --source-repo ../catalyst --docs-repo . \
  --base origin/main --head HEAD --dry-run

# Whole-repo audit: gaps, stale pages, vanished sources
node tools/docs-agent/bin/docs-agent.mjs audit \
  --source-repo ../catalyst --docs-repo .

# One feature: e.g. backups, nodes, permissions, templates, networking
node tools/docs-agent/bin/docs-agent.mjs feature --feature backups \
  --source-repo ../catalyst --docs-repo .

# Read-only consistency check
node tools/docs-agent/bin/docs-agent.mjs validate --docs-repo .

# Regenerate the OpenAPI artifact from a Catalyst checkout + report the delta
node tools/docs-agent/bin/docs-agent.mjs api --source-repo ../catalyst

# Machine-readable output for CI
node tools/docs-agent/bin/docs-agent.mjs diff ... --json
```

`diff`/`feature` write proposed changes into the docs **working tree without
committing** (review the diff, then open a PR). `--dry-run` writes nothing.
The agent never force-pushes, never publishes, never commits secrets.

## How change mapping works (deterministic first, LLM second)

1. `git diff --name-only BASE..HEAD` → changed files.
2. `lib/classify.mjs` maps paths to features/audiences via rules
   (routes, agent, installer, i18n, error codes, …). Pure-path rules need no
   model and are covered by `tests/`.
3. Docs pages declare what they document in frontmatter `sources:` globs;
   `lib/frontmatter.mjs` matches changed files to candidate pages.
4. Only then, if credentials exist, the LLM drafts minimal edits under the
   system prompt in `lib/prompts.mjs`. Without credentials the agent still
   classifies, validates, and reports — prose is left to humans.

## LLM providers

| Env | Provider |
| --- | --- |
| `DOCS_AGENT_BASE_URL` + `DOCS_AGENT_API_KEY` (+ optional `DOCS_AGENT_MODEL`) | Any OpenAI-compatible endpoint |
| `DOCS_AGENT_ANTHROPIC_KEY` (+ optional `DOCS_AGENT_ANTHROPIC_MODEL`) | Anthropic Messages API |

No credentials → heuristic mode (classification + validation + reports).

## Output

Every analysis prints a Documentation Impact block:

```text
USER:            update required / no change
ADMIN:           update required / no change
API GUIDES:      update required / no change
API REFERENCE:   regenerated / unchanged
TROUBLESHOOTING: update required / no change
MIGRATION:       update required / no change
INTERNAL ONLY:   yes / no
```

plus affected features, examined/changed pages, confidence, and whether human
review is needed.

## Safety rules (enforced by design, not just prompting)

- Never invents features, flags, defaults, ports, permissions, or API fields.
- Verifies behavior from source/config/schema, not filenames.
- Leaves good human prose alone; appends clearly-marked agent notes for review.
- `validate` and `--dry-run` change nothing.

## Tests

```bash
pnpm test   # node:test, no dependencies
```

Fixtures cover: UI copy churn (no impact), server/admin settings, API route
changes, permission changes, internal refactors, removed features, and
CLI/config changes.
