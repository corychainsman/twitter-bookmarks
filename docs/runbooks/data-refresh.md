# Data Refresh Runbook

Use this runbook for agents inspecting, validating, or explicitly refreshing the shipped bookmark data artifacts.

## Policy

Agents may inspect and validate data artifacts at any time. Agents must only run refresh or export commands that can change `public/data` when the user explicitly requests a data refresh/export.

`public/data` is shipped public output. Raw Field Theory cache data belongs in `.data/fieldtheory` and must remain local.

## Prerequisites (check these before running `bun run refresh`)

1. **Field Theory session**: `sync:ft` drives a real local X session. If it
   fails with auth errors, the user must re-authenticate Field Theory; an
   agent cannot fix this alone. If X temporarily limits login in the controlled
   browser but the user is already logged into X on their Mac, have them run
   the Mac helper from that machine:

   ```zsh
   cd ~/twitter-bookmarks
   PROFILE_NAME=Work REMOTE_HOST=nuc scripts/send-x-cookies-from-mac.zsh
   ```

   `PROFILE_NAME` matches Chrome's visible profile name. `PROFILE` can be used
   instead when the Chrome profile folder is known, for example
   `PROFILE=Default`.
2. **1Password CLI unlocked**: `mirror:sync` pulls R2 credentials
   (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`) via `op environment read`
   (environment ID is hardcoded in `scripts/sync-mirror.sh`). Verify with
   `op environment read <id> | head -1` (note: `op whoami` may say "not
   signed in" even when environment reads work — don't trust it). If the
   read fails, the user must unlock the 1Password app and enable
   Settings → Developer → CLI integration. Symptom of missing credentials:
   rclone errors mentioning "EC2 IMDS" / 169.254.169.254.
3. **rclone remotes**: `r2:` (Cloudflare R2) and `gdrive:` (Google Drive
   OAuth) must exist. Verify with `rclone listremotes`. If `r2:` is missing,
   `mirror:sync` will skip the serving upload and the exported self-hosted
   URLs may not be live. If Drive token expired:
   `rclone config reconnect gdrive:` (needs browser).
4. **Ordering matters**: `data:mirror` must run before `data:export`
   (export rewrites URLs only for assets confirmed in the mirror manifest),
   and `mirror:sync` must succeed before deploying (so every rewritten URL
   is actually live on R2). `data:semantic-enrichment` reads images and sampled
   video frames from the local archive, so it also depends on `data:mirror`.
5. **Semantic enrichment is incremental and resumable** —
   `data:semantic-enrichment` captions and OCRs a bounded newest-first batch of
   missing image/video assets and writes `data/semantic-enrichment.json`.
   Set `SEMANTIC_ENRICHMENT_LIMIT` to tune the hourly batch or pass `--all` for
   an operator-run bootstrap. The Florence model cache remains under ignored
   `.data/models`.
6. **`data:embeddings` regenerates the compact record index** — if export runs without
   the embeddings step, `public/data/embeddings` goes stale/missing; always
   run the full chain (the `refresh` script does this).

## Pipeline

The full refresh pipeline is owned by `scripts/refresh-pipeline.ts`; the
package commands are thin adapters around that Module. The ordered steps are:

```bash
bun run sync:ft
bun run data:mirror
bun run data:video-previews
bun run mirror:sync
bun run data:export
bun run data:semantic-enrichment
bun run data:embeddings
bun run data:validate
bun run build
```

Convenience commands all preserve the complete mirror/publication/export chain:

- `bun run refresh`: incremental sync followed by the full pipeline.
- `bun run refresh:resume`: resume the sync adapter, then run the full pipeline.
- `bun run refresh:full`: full sync followed by the full pipeline.
- `bun run refresh:embeddings`: compatibility alias for the complete pipeline;
  it does not bypass media publication or validation.
- `bun run refresh:production`: incremental production refresh. It checks the
  tracked GitHub checkpoint, syncs only through a full page of already-known
  bookmark IDs, and stops before media/export/deploy work when the token and
  count are unchanged. When changes exist, it runs the remaining full pipeline,
  deploys staging then production, smoke-checks both, and only then advances the
  checkpoint and pushes it with `public/data` to GitHub.
- `bun run refresh:production:full`: forces an authoritative full-folder
  reconciliation before publication. The hourly production command also does
  this automatically when the last full reconciliation is at least seven days
  old or the GitHub token is absent from the local cache.

## GitHub refresh checkpoint

Before any production refresh, read `ops/refresh-state.json`. Its
`newestBookmarkId` is the durable last-successful token stored in GitHub; do not
use the timestamp alone as the incremental boundary. Confirm that token exists
in `.data/fieldtheory/bookmarks.jsonl`. If the checkpoint is missing, malformed,
or absent from the local cache, run a full reconciliation.

Unattended syncs read X cookies from the protected local cache at
`~/.config/twitter-bookmarks/x-cookies.json` when 1Password is unavailable to
the systemd environment. Any successful interactive 1Password read or cookie
capture refreshes that mode-0600 cache; it is machine-local and never committed.

X's folder timeline has no reliable `since` parameter. Incremental syncs
therefore walk newest-first until they include a complete page of IDs already
known locally, then merge the overlap ahead of the preserved older timeline.
This catches bursts larger than one page without parsing the entire folder.
Hourly incrementals are additive; the mandatory weekly full walk reconciles
unbookmarks and folder removals.

Never advance `ops/refresh-state.json` before all of these succeed:

1. X sync and the ordered publication pipeline.
2. Staging and production deployment of the validated build pair. Each Worker
   reads its own bundled catalog through its asset binding.
3. Exact catalog manifest/API smoke checks on both public hostnames.
4. Git commit and push of `ops/refresh-state.json`, `public/data`, and
   `data/semantic-enrichment.json`.

The checkpoint remains unchanged on a failed run. If X contains nothing newer
than the checkpoint and the bookmark count is unchanged, publication is skipped
and no Git commit is created.

## Hourly systemd automation

The installed user timer is sourced from `ops/systemd/`:

```bash
install -Dm644 ops/systemd/elsewhere-bookmark-refresh.service ~/.config/systemd/user/elsewhere-bookmark-refresh.service
install -Dm644 ops/systemd/elsewhere-bookmark-refresh.timer ~/.config/systemd/user/elsewhere-bookmark-refresh.timer
systemctl --user daemon-reload
systemctl --user enable --now elsewhere-bookmark-refresh.timer
```

The timer runs hourly with up to five minutes of jitter. `flock` prevents an
overlapping refresh when a prior media or embedding job is still running.
Inspect its schedule and logs with:

```bash
systemctl --user list-timers elsewhere-bookmark-refresh.timer --no-pager
systemctl --user status elsewhere-bookmark-refresh.service --no-pager
journalctl --user -u elsewhere-bookmark-refresh.service -n 200 --no-pager
```

The production commands set `SKIP_GDRIVE_BACKUP=1`: R2 publication remains a
hard deployment gate, while the throttle-prone Google Drive cold archive is
resumed independently every day. Install and inspect that timer with:

```bash
install -Dm644 ops/systemd/elsewhere-media-backup.service ~/.config/systemd/user/elsewhere-media-backup.service
install -Dm644 ops/systemd/elsewhere-media-backup.timer ~/.config/systemd/user/elsewhere-media-backup.timer
systemctl --user daemon-reload
systemctl --user enable --now elsewhere-media-backup.timer
systemctl --user list-timers elsewhere-media-backup.timer --no-pager
journalctl --user -u elsewhere-media-backup.service -n 200 --no-pager
```

Run `bun run backup:gdrive` to resume it manually. It uses append-only
`rclone copy`, so an interrupted or throttled baseline safely continues without
deleting or re-uploading completed objects.

Before any refresh step runs, the pipeline preflights `mirror:sync`
dependencies and fails if `rclone` or either required remote (`r2:`,
`gdrive:`) is missing. This prevents a partial refresh that rewrites public
media URLs before the serving mirror can be uploaded.

## Command Notes

- `bun run sync:ft` depends on a real local Field Theory/X session and writes raw local cache data under `.data/fieldtheory`.
- `bun run auth:x:check` validates the stored X credentials from 1Password.
- `bun run auth:x:ensure` validates stored X credentials, starts the controlled
  auth browser when needed, captures fresh cookies through CDP, stores them in
  1Password, and stops if X shows a temporary limit page.
- `bun run data:mirror` downloads media originals into `.data/media` and generates the bounded 240/320/480/680/1280/2048px AVIF ladder + ThumbHashes (see `docs/runbooks/media-mirror.md`).
- `bun run mirror:sync` uploads the archive to R2 (serving) and Google Drive (backup) via rclone.
- `bun run data:export` writes normalized static bookmark artifacts under `public/data`, rewriting media URLs to the self-hosted mirror for assets confirmed in the mirror manifest.
- `bun run data:semantic-enrichment` locally captions/OCRs up to 32 missing
  media assets by default. Video enrichment includes the poster and sampled
  frames. Completed entries are written atomically after each asset, so an
  interrupted run resumes safely.
- `bun run data:embeddings` writes the static semantic embedding index under `public/data`.
- `bun run data:validate` validates exported artifacts.
- `bun run build` confirms the static app builds with the exported artifacts.

## Rclone / R2 Operations

`scripts/sync-mirror.sh` expects:

- R2 remote name: `r2:`
- R2 bucket: `twitter-bookmarks`
- Public media host: `https://tbmedia.corychainsman.com`
- Google Drive backup remote: `gdrive:corychainsman.com/media/twitter-bookmarks`
- 1Password environment ID for R2 keys: `gmp47wpivdhzcupejaeajlboy4`
- R2 account ID: `7bf5e5abbd39f0f6b5fc9951e716c7a8`

Check the current rclone state:

```bash
rclone config file
rclone listremotes
rclone lsd r2:
rclone lsd r2:twitter-bookmarks
```

Create or repair the `r2:` remote:

```bash
cd ~/twitter-bookmarks

export OP_ENVIRONMENT_ID="gmp47wpivdhzcupejaeajlboy4"
export R2_ACCOUNT_ID="7bf5e5abbd39f0f6b5fc9951e716c7a8"

eval "$(op environment read "$OP_ENVIRONMENT_ID" | grep '^AWS_' | sed 's/^/export /')"

rclone config create r2 s3 \
  provider Cloudflare \
  access_key_id "$AWS_ACCESS_KEY_ID" \
  secret_access_key "$AWS_SECRET_ACCESS_KEY" \
  endpoint "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  acl private

rclone mkdir r2:twitter-bookmarks
rclone lsd r2:twitter-bookmarks
```

Do not mount this R2 bucket as a persistent filesystem. Home-directory
indexers recursively walked the prior FUSE mount and generated millions of
billable `ListObjects` calls. Use explicit, prefix-scoped `rclone` commands.

`mirror:sync` builds a manifest-derived list of unpublished immutable keys and
uploads only those keys with `--files-from-raw --no-traverse --no-check-dest`.
It never lists the remote bucket during the hourly path. Newly uploaded media
is checked through the CDN before its publication attestation advances. Once
per seven days the same CDN path verifies the full catalog; this uses cached
HTTP `HEAD` requests rather than billable R2 Class A listings.

Emergency confirmation that no legacy mount remains:

```bash
systemctl --user is-enabled rclone-r2-twitter-bookmarks.service  # not-found or disabled
findmnt ~/mnt/r2-twitter-bookmarks                               # no FUSE mount
pgrep -af 'rclone mount r2:twitter-bookmarks'                    # no output
```

Set account-level budget alerts in Cloudflare under **Billing > Billable
Usage** at $1 (early warning) and $5 (unexpected-usage escalation). Cloudflare
budget alerts are delayed notifications, not hard spending caps, so also check
R2 Analytics after changing publication behavior. Healthy hourly refreshes
should show no `ListObjects` operations; `PutObject` should track only newly
mirrored media.

After adding or repairing `r2:`, run:

```bash
bun run mirror:sync
```

Expected healthy `mirror:sync` behavior:

- It prints the number of new immutable objects and does not enumerate the
  remote tree.
- It does not print `Skipping R2 sync: no 'r2' rclone remote configured.`
- It verifies new objects through `tbmedia.corychainsman.com` before export.

## Review Checklist

Before completing data refresh work, report whether `public/data` changed and whether validation/build commands passed. Do not commit raw Field Theory cache data.

`data:validate` prints mirror coverage ("N/M media URLs self-hosted") — a
handful of twimg URLs is expected (permanently dead assets), but a large or
growing twimg count means `data:mirror`/`mirror:sync` did not run or failed.
