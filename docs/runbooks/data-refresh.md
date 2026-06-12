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
3. **rclone remotes**: `r2:` (Cloudflare R2, env_auth) and `gdrive:` (Google
   Drive OAuth) must exist. If Drive token expired:
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

## Review Checklist

Before completing data refresh work, report whether `public/data` changed and whether validation/build commands passed. Do not commit raw Field Theory cache data.

`data:validate` prints mirror coverage ("N/M media URLs self-hosted") — a
handful of twimg URLs is expected (permanently dead assets), but a large or
growing twimg count means `data:mirror`/`mirror:sync` did not run or failed.
