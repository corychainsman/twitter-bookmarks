# Media Mirror & Cloudflare Setup

The app self-hosts all tweet media (photos, videos, GIF mp4s, posters) instead
of relying on `pbs.twimg.com` / `video.twimg.com`. This runbook covers the
pipeline and the one-time Cloudflare/Namecheap/Drive setup.

## Architecture

- **Local archive (source of truth)**: `.data/media/assets/` — full-fidelity
  originals plus generated AVIF renditions, video previews, and playback
  assets. Image originals and v2 renditions are content-addressed; rendition
  records carry truthful dimensions, bytes, MIME type, and digest in
  `.data/media/mirror-manifest.json`. The width ladder is centralized in
  `scripts/mirror-lib.ts` and capped at the oriented source width.
- **Serving**: Cloudflare R2 bucket `twitter-bookmarks`, public at
  `https://tbmedia.corychainsman.com` (custom domain on the Cloudflare CDN).
- **Backup**: Google Drive at `corychainsman.com/media/twitter-bookmarks/`
  (originals + manifest + exported JSON; AVIF variants are regenerable and
  excluded).
- **Publication gate**: R2 is hash-checked and every manifest-referenced URL is
  verified through the public media origin before export receives a matching
  local attestation.
- **Export rewrite**: `data:export` rewrites media URLs to concrete mirrored
  originals and attaches the explicit rendition catalog. Runtime code never
  guesses v2 paths from URL conventions and never falls back from a mirrored
  item to twimg. Docs keep the upstream URL in `originUrl`; grid items gain a
  `thumbhash`.

## Pipeline

`bun run refresh` runs: `sync:ft → data:mirror →
data:backfill-image-variants → data:video-previews → mirror:sync → data:export
→ data:embeddings → data:validate → build`.

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
3. Cache rule (Rules → Cache Rules): host `tbmedia.corychainsman.com` →
   Cache eligible, Edge TTL 1 year, Browser TTL 1 year. Asset URLs are
   immutable (content never changes under a key). Live as of 2026-07-06 via
   the zone's `http_request_cache_settings` ruleset (see
   `set_cache_settings` rule matching `http.host eq "tbmedia.corychainsman.com"`).
   `sync-mirror.sh` also sets the same `Cache-Control` header at upload time
   as a belt-and-suspenders origin default.
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
bun run data:backfill-image-variants
bun run data:video-previews
bun run mirror:sync          # upload and verify newly generated objects
bun run data:export && bun run data:embeddings && bun run data:validate
bun run build                # then deploy as usual
```

## Video playback

Videos and animated GIFs autoplay (muted, looping) in both the grid and the
lightbox.

**Preview clips (grid tier).** Every mirrored video gets a downscaled,
audio-stripped MP4 for in-grid autoplay so that many tiles can decode at once
without streaming the multi-MB originals. `bun run data:video-previews`
(`scripts/generate-video-previews.ts`) runs ffmpeg over each `ok` video in the
manifest and writes `vid/<stem>/preview.mp4` — width 480, H.264 CRF 31, no
audio, `+faststart`, capped at 8 seconds (the grid only shows a muted loop, so
long videos don't need full-runtime previews) — recording
`previewKey`/`previewBytes` in the manifest. Note: preview/playback files are
served with a 1-year immutable cache TTL, so re-encoding one in place requires
purging its URL from the Cloudflare cache (`POST /zones/<id>/purge_cache`)
after `mirror:sync`.
It is incremental (skips videos that already have a preview file; `--force` to
re-encode) and supports `--limit N`, `--concurrency N`, `--dry-run`. Typical
output is ~0.5 MB per clip vs ~5 MB average for the original. The clips live
alongside the AVIF poster variants under the same stem and are regenerable, so
`mirror:sync` uploads them to R2 (full-tree `rclone copy`) but excludes them
from the Google Drive cold backup.

`data:export` (`mirror-rewrite.ts`) sets `GridItem.previewUrl` from the video
record's `previewKey`; the grid uses `previewUrl ?? fullUrl`. `bun run refresh`
runs `data:mirror → data:backfill-image-variants → data:video-previews →
mirror:sync → data:export → …`.

**Grid tiles** (`GridVideoPreview.tsx`): the preview clip autoplays muted and
looping after at least 10% of its tile is visible, then continues until 0% is
visible. The values live together in `autoplay.ts`. Deferred tiles attach
neither `src` nor `poster`; admission is monotonic for the lifetime of a
mounted tile, so later scroll-priority changes do not reset playback. Hidden
measurement tiles do not create playback observers. Opening the lightbox
temporarily disables all grid playback.

**Lightbox**: plays and loops the full-resolution original (`media.fullUrl`),
not the preview. All video slides autoplay muted via the HTML `autoPlay` attribute
(`muted` is required by the iOS Safari autoplay policy); native controls let
the user unmute, pause, and seek.

## Failure handling

Dead twimg URLs (deleted tweets) are recorded as `failed` in the manifest and
never block a refresh — their tweets keep twimg URLs and degrade gracefully.
`data:validate` prints how many URLs are still on twimg. Retry transient
failures with `bun run data:mirror -- --retry-failed`.
