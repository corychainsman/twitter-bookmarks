#!/usr/bin/env bash
# Syncs the local media archive (.data/media) to its two off-site targets:
#
#   1. Cloudflare R2 (serving + archive): full tree including AVIF variants.
#      Requires an rclone remote named "r2" pointing at the account, e.g.
#        rclone config create r2 s3 provider=Cloudflare \
#          access_key_id=... secret_access_key=... \
#          endpoint=https://<account-id>.r2.cloudflarestorage.com
#   2. Google Drive (cold backup): originals + manifest + exported JSON only;
#      AVIF variants and video preview clips are regenerable so they are excluded.
#      Requires the existing "gdrive" remote (rclone config reconnect gdrive:
#      if the token has expired).
#
# Uses `rclone copy` (never deletes remote files) so the backups are append-only.
set -euo pipefail

cd "$(dirname "$0")/.."

# R2 credentials come from the 1Password "Environments" entry (rclone r2 remote
# uses env_auth). Pull AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY if not already set.
OP_ENVIRONMENT_ID="gmp47wpivdhzcupejaeajlboy4"
if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  if command -v op >/dev/null; then
    eval "$(op environment read "$OP_ENVIRONMENT_ID" | grep '^AWS_' | sed 's/^/export /')" ||
      echo "Warning: could not read 1Password environment; R2 sync may fail." >&2
  fi
fi

ASSETS_DIR=".data/media/assets"
MANIFEST=".data/media/mirror-manifest.json"
R2_TARGET="r2:twitter-bookmarks"

if [[ ! -d "$ASSETS_DIR" ]]; then
  echo "No local archive at $ASSETS_DIR — run 'bun run data:mirror' first." >&2
  exit 1
fi

if rclone listremotes | grep -q '^r2:'; then
  echo "Syncing full archive to $R2_TARGET ..."
  # Assets are immutable (content never changes under a key), so tell R2/Cloudflare
  # to cache them for a year. A zone-level Cache Rule on tbmedia.corychainsman.com
  # already overrides edge/browser TTL regardless of this header, but setting it at
  # the origin too means the right behavior doesn't depend on that dashboard config.
  rclone copy "$ASSETS_DIR" "$R2_TARGET" --fast-list --transfers 16 --stats-one-line -P \
    --header-upload "Cache-Control: public, max-age=31536000, immutable"
  echo "Verifying R2 publication completeness ..."
  rclone check "$ASSETS_DIR" "$R2_TARGET" --one-way --fast-list
  echo "Verifying catalog objects through the public media origin ..."
  bun run scripts/media-publication.ts
else
  echo "Skipping R2 sync: no 'r2' rclone remote configured." >&2
fi

if [[ "${SKIP_GDRIVE_BACKUP:-0}" == "1" ]]; then
  echo "Deferring Google Drive cold backup to its independent timer."
elif rclone listremotes | grep -q '^gdrive:'; then
  bash scripts/backup-gdrive.sh
else
  echo "Skipping Google Drive backup: no 'gdrive' rclone remote configured." >&2
fi

echo "Mirror sync complete."
