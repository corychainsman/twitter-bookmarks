# X Inspo Deployment Runbook

X Inspo is staged on an isolated Cloudflare Worker and custom domain before
any production-hostname promotion.

## Deployment boundaries

- Staging Worker: `elsewhere-media-wall-dev`
- Staging hostname: `dev.bookmarks.corychainsman.com`
- Production Worker: `elsewhere-media-wall`
- Production hostname: `bookmarks.corychainsman.com`
- Staging data source: its own bundled `/data` assets through the Worker asset
  binding (`USE_LOCAL_DATA=true`), isolated from production.
- Production data source: its own bundled `/data` assets through the Worker
  asset binding (`USE_LOCAL_DATA=true`).
- Media source: rendition URLs in the production catalog, currently served by
  `https://tbmedia.corychainsman.com`

`wrangler.jsonc` remains staging-only. `wrangler.production.jsonc` is the
explicit production configuration. The versioned catalog under `public/data`
is deployed independently with each application and read through that
deployment's asset binding.

## Deploy staging

From the repository root:

```bash
bun run api:generate
bun run test
bun run typecheck
bun run lint
bun run build
bun run deploy:cf:staging
```

Wrangler authentication must have Worker script and custom-domain permissions.

## Verify staging

Verify all of the following before considering promotion:

1. `/api/discovery` returns JSON with real records and a next cursor.
2. Search, kind/source/width/date filters, sorts, and cursor append work.
3. Wall images and preview videos load from the production media origin.
   Inspect representative image and video-poster `currentSrc` values at mobile
   and desktop widths; wall cells should select the smallest adequate candidate
   from the 240/320/480/680/1280/2048px AVIF ladder, not the original asset.
4. `/media/:mediaId` opens directly, injects record-specific Open Graph and
   Twitter tags, and hydrates the addressable lightbox.
5. Desktop and simulated-mobile browser runs have no console or page errors.
6. A cold Lighthouse run reports zero wall-induced CLS. The shadcn skeleton
   should remain until the positioned wall covers the viewport and lookahead,
   then disappear without a second visible reflow.
7. Root HTML responses include CSP, HSTS, framing, MIME-sniffing, referrer, and
   permissions headers; `/robots.txt` is plain text rather than the SPA shell.
8. The existing production hostname still serves its prior deployment.

## Promotion

Promotion is a separate explicit change. Preserve and verify staging first,
then run:

```bash
bun run deploy:cf:production
```

Repeat the staging verification checklist against the production hostname.
The staging Worker remains independently deployable and can receive a rollback
build before the production route is changed again.
