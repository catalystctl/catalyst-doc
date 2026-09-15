# Deployment — docs.catalystctl.com on Cloudflare Pages

The site is fully static. Cloudflare Pages builds it from this repo and serves
`docs.catalystctl.com`.

## Cloudflare Pages project (live)

| Setting | Value |
| --- | --- |
| Project | `catalyst-docs` (`catalyst-docs.pages.dev`) |
| Source | GitHub `catalystctl/catalyst-doc`, production branch `main` |
| Framework preset | Astro (or None — the build command is explicit) |
| Build command | `pnpm run build` (`prebuild` refreshes `public/openapi.json` first) |
| Output directory | `dist` |
| Env vars | `NODE_VERSION=22` (production + preview) |
| Root directory | `/` (repo root) |
| Custom domain | `docs.catalystctl.com` (zone `catalystctl.com` is on Cloudflare; TLS automatic) |

No secrets are required — the build is hermetic.
`pnpm install --frozen-lockfile` runs before the build (lockfile committed).

## Custom domain

1. Pages project → **Custom domains** → add `docs.catalystctl.com`.
2. At your DNS provider, add the `CNAME` Cloudflare shows (or let Cloudflare
   manage DNS automatically if the zone is on Cloudflare).
3. TLS is issued automatically. Enforce HTTPS + HSTS on the domain.

## Behavior

- Pushes to `main` → production deployment (`docs.catalystctl.com`).
- Pull requests → versioned preview deployments with a comment link; reviewers
  check rendering before merge.
- Rollback: redeploy any previous successful deployment from the Pages dashboard.

## Verify locally with the exact production command

```bash
pnpm install --frozen-lockfile
pnpm run build   # output in dist/
pnpm preview     # serve dist/ locally
```

## wrangler (optional)

This repo intentionally ships **no** `wrangler.toml`: a static Pages project
needs none. If you later add Pages Functions or redirects, add `_routes.json`
/ `_redirects` under `public/` and document them here.
