#!/usr/bin/env bash
# Syncs the local media archive (.data/media) to its two off-site targets:
#
#   1. Cloudflare R2 (serving + archive): full tree including AVIF variants.
#      Requires an rclone remote named "r2" pointing at the account, e.g.
#        rclone config create r2 s3 provider=Cloudflare \
#          access_key_id=... secret_access_key=... \
#          endpoint=https://<account-id>.r2.cloudflarestorage.com
#   2. Google Drive (cold backup): originals + manifest + exported JSON only;
#      AVIF variants are regenerable so they are excluded.
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
GDRIVE_TARGET="gdrive:corychainsman.com/media/twitter-bookmarks"

if [[ ! -d "$ASSETS_DIR" ]]; then
  echo "No local archive at $ASSETS_DIR — run 'bun run data:mirror' first." >&2
  exit 1
fi

if rclone listremotes | grep -q '^r2:'; then
  echo "Syncing full archive to $R2_TARGET ..."
  rclone copy "$ASSETS_DIR" "$R2_TARGET" --fast-list --transfers 16 --stats-one-line -P
else
  echo "Skipping R2 sync: no 'r2' rclone remote configured." >&2
fi

if rclone listremotes | grep -q '^gdrive:'; then
  echo "Backing up originals + manifest to $GDRIVE_TARGET ..."
  rclone copy "$ASSETS_DIR" "$GDRIVE_TARGET/assets" \
    --exclude '*.avif' --fast-list --transfers 8 --stats-one-line -P
  rclone copyto "$MANIFEST" "$GDRIVE_TARGET/mirror-manifest.json"
  rclone copy public/data "$GDRIVE_TARGET/data" --fast-list --stats-one-line
else
  echo "Skipping Google Drive backup: no 'gdrive' rclone remote configured." >&2
fi

echo "Mirror sync complete."
