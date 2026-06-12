# Media Mirror & Cloudflare Setup

The app self-hosts all tweet media (photos, videos, GIF mp4s, posters) instead
of relying on `pbs.twimg.com` / `video.twimg.com`. This runbook covers the
pipeline and the one-time Cloudflare/Namecheap/Drive setup.

## Architecture

- **Local archive (source of truth)**: `.data/media/assets/` — originals at
  full fidelity (`pbs/<twimg-path>`, `vid/<twimg-path>`) plus pre-generated
  AVIF variants (`<stem>/w320.avif`, `w680.avif`, `w1280.avif`) and a per-asset
  status manifest at `.data/media/mirror-manifest.json`.
- **Serving**: Cloudflare R2 bucket `twitter-bookmarks`, public at
  `https://tbmedia.corychainsman.com` (custom domain on the Cloudflare CDN).
- **Backup**: Google Drive at `corychainsman.com/media/twitter-bookmarks/`
  (originals + manifest + exported JSON; AVIF variants are regenerable and
  excluded).
- **Export rewrite**: `data:export` rewrites `thumbUrl`/`fullUrl`/`posterUrl`
  in the exported JSON to mirror URLs for every asset confirmed in the
  manifest; failed/unmirrored assets keep their twimg URLs. Docs keep the
  original URL in `originUrl`; grid items gain a `thumbhash`.
- The app derives AVIF tiers from mirrored URLs by convention (path starts
  with `/pbs/`); `MEDIA_BASE_URL` env overrides the default base URL at
  export time.

## Pipeline

`bun run refresh` now runs: `sync:ft → data:mirror → mirror:sync →
data:export → data:embeddings → data:validate → build`.

- `bun run data:mirror` — incremental; downloads only assets not yet mirrored.
  Flags: `--limit N`, `--concurrency N`, `--retry-failed`, `--dry-run`.
- `bun run mirror:sync` — rclone copy to R2 (full tree) and Drive (originals
  only). Append-only; never deletes remote objects. Skips targets whose
  rclone remote is missing.
- `bun run data:validate` — reports mirror coverage (self-hosted vs twimg
  URLs) alongside the existing checks.

## One-time setup

### 1. Cloudflare zone (corychainsman.com is on Namecheap BasicDNS)

1. Create/log into Cloudflare, **Add a site** → `corychainsman.com` (Free plan).
2. Before switching nameservers, pre-stage the two services that die with
   Namecheap DNS:
   - **Email Routing** (Email → Email Routing): catch-all
     `*@corychainsman.com` → `cory@chainsman.com` (verify the destination
     address when prompted).
   - **Redirect Rule** (Rules → Redirect Rules): `corychainsman.com/*` →
     302 to the Google Slides URL currently served by Namecheap URL Forward
     (`curl -sI http://corychainsman.com` shows it).
3. Namecheap → Domain → Nameservers → Custom DNS → the two Cloudflare
   nameservers shown in the dashboard. Wait for the zone to go Active.
4. Verify: email to anything@corychainsman.com arrives; apex still redirects.

### 2. R2 bucket + custom domain

1. R2 → Create bucket `twitter-bookmarks` (location: automatic).
2. Bucket → Settings → Custom Domains → add `tbmedia.corychainsman.com`
   (Cloudflare creates the DNS record; enables CDN caching).
3. Recommended cache rule (Rules → Cache Rules): host
   `tbmedia.corychainsman.com` → Cache eligible, Edge TTL 1 year, Browser TTL
   1 year. Asset URLs are immutable (content never changes under a key).
4. Create an API token for rclone: R2 → Manage R2 API Tokens →
   Object Read & Write, scoped to the bucket. The `r2` remote uses
   `env_auth = true`; the credentials (`AWS_ACCESS_KEY_ID` /
   `AWS_SECRET_ACCESS_KEY`) live in a 1Password Environment and
   `sync-mirror.sh` pulls them at runtime via `op environment read`
   (requires the 1Password app's CLI integration enabled and unlocked).

### 3. Google Drive remote

The `gdrive:` rclone remote exists; if the token has expired run
`rclone config reconnect gdrive:` (browser OAuth).

### 4. First publish

```bash
bun run mirror:sync          # upload archive to R2 + Drive
bun run data:export && bun run data:embeddings && bun run data:validate
bun run build                # then deploy as usual
```

## Failure handling

Dead twimg URLs (deleted tweets) are recorded as `failed` in the manifest and
never block a refresh — their tweets keep twimg URLs and degrade gracefully.
`data:validate` prints how many URLs are still on twimg. Retry transient
failures with `bun run data:mirror -- --retry-failed`.
