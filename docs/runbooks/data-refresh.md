# Data Refresh Runbook

Use this runbook for agents inspecting, validating, or explicitly refreshing the shipped bookmark data artifacts.

## Policy

Agents may inspect and validate data artifacts at any time. Agents must only run refresh or export commands that can change `public/data` when the user explicitly requests a data refresh/export.

`public/data` is shipped public output. Raw Field Theory cache data belongs in `.data/fieldtheory` and must remain local.

## Prerequisites (check these before running `bun run refresh`)

1. **Field Theory session**: `sync:ft` drives a real local X session. If it
   fails with auth errors, the user must re-authenticate Field Theory; an
   agent cannot fix this alone.
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
   is actually live on R2). `data:embeddings` reads images from the local
   archive (`.data/media/assets/`), so it also depends on `data:mirror`.
5. **`data:embeddings` regenerates the whole index** — if export runs without
   the embeddings step, `public/data/embeddings` goes stale/missing; always
   run the full chain (the `refresh` script does this).

## Pipeline

The full refresh pipeline is:

```bash
bun run sync:ft
bun run data:mirror
bun run mirror:sync
bun run data:export
bun run data:embeddings
bun run data:validate
bun run build
```

Convenience commands:

- `bun run refresh`: sync, export, embeddings, validate, and build.
- `bun run refresh:resume`: resume sync, then export, embeddings, validate, and build.
- `bun run refresh:full`: full sync, then export, embeddings, validate, and build.
- `bun run refresh:embeddings`: sync, export, embeddings, validate, and build.

## Command Notes

- `bun run sync:ft` depends on a real local Field Theory/X session and writes raw local cache data under `.data/fieldtheory`.
- `bun run data:mirror` downloads media originals into `.data/media` and generates AVIF variants + ThumbHashes (see `docs/runbooks/media-mirror.md`).
- `bun run mirror:sync` uploads the archive to R2 (serving) and Google Drive (backup) via rclone.
- `bun run data:export` writes normalized static bookmark artifacts under `public/data`, rewriting media URLs to the self-hosted mirror for assets confirmed in the mirror manifest.
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

Persistent R2 mount:

- Service file: `~/.config/systemd/user/rclone-r2-twitter-bookmarks.service`
- Mount point: `~/mnt/r2-twitter-bookmarks`
- Service name: `rclone-r2-twitter-bookmarks.service`
- User lingering should be enabled so the user service can start on boot.

Expected service file:

```ini
[Unit]
Description=Mount Cloudflare R2 twitter-bookmarks bucket
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStartPre=/usr/bin/mkdir -p %h/mnt/r2-twitter-bookmarks
ExecStart=/home/linuxbrew/.linuxbrew/bin/rclone mount r2:twitter-bookmarks %h/mnt/r2-twitter-bookmarks --vfs-cache-mode writes --dir-cache-time 1h --poll-interval 1m --umask 022
ExecStop=/usr/bin/fusermount -u %h/mnt/r2-twitter-bookmarks
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

Enable, start, and verify the mount:

```bash
loginctl enable-linger cory
systemctl --user daemon-reload
systemctl --user enable --now rclone-r2-twitter-bookmarks.service

systemctl --user status rclone-r2-twitter-bookmarks.service --no-pager
findmnt ~/mnt/r2-twitter-bookmarks
ls ~/mnt/r2-twitter-bookmarks
loginctl show-user cory -p Linger
```

Useful maintenance commands:

```bash
systemctl --user restart rclone-r2-twitter-bookmarks.service
systemctl --user stop rclone-r2-twitter-bookmarks.service
systemctl --user disable rclone-r2-twitter-bookmarks.service
fusermount -u ~/mnt/r2-twitter-bookmarks
```

After adding or repairing `r2:`, run:

```bash
bun run mirror:sync
```

Expected healthy `mirror:sync` behavior:

- It prints `Syncing full archive to r2:twitter-bookmarks ...`.
- It does not print `Skipping R2 sync: no 'r2' rclone remote configured.`
- It completes the R2 upload before backing up originals and public data to
  Google Drive.

## Review Checklist

Before completing data refresh work, report whether `public/data` changed and whether validation/build commands passed. Do not commit raw Field Theory cache data.

`data:validate` prints mirror coverage ("N/M media URLs self-hosted") — a
handful of twimg URLs is expected (permanently dead assets), but a large or
growing twimg count means `data:mirror`/`mirror:sync` did not run or failed.
