#!/usr/bin/env bash
# Resumable, append-only cold backup. This is deliberately independent of the
# serving refresh because Google Drive can heavily throttle large baselines.
set -euo pipefail

cd "$(dirname "$0")/.."

ASSETS_DIR=".data/media/assets"
MANIFEST=".data/media/mirror-manifest.json"
GDRIVE_TARGET="gdrive:corychainsman.com/media/twitter-bookmarks"

if [[ ! -d "$ASSETS_DIR" || ! -f "$MANIFEST" ]]; then
  echo "No local media archive — run 'bun run data:mirror' first." >&2
  exit 1
fi

if ! rclone listremotes | grep -q '^gdrive:'; then
  echo "Missing required 'gdrive:' rclone remote." >&2
  exit 1
fi

echo "Backing up originals + manifest to $GDRIVE_TARGET ..."
rclone copy "$ASSETS_DIR" "$GDRIVE_TARGET/assets" \
  --exclude '*.avif' --exclude 'preview.mp4' --fast-list --transfers 8 --stats-one-line -P
rclone copyto "$MANIFEST" "$GDRIVE_TARGET/mirror-manifest.json"
rclone copy public/data "$GDRIVE_TARGET/data" --fast-list --stats-one-line
echo "Google Drive cold backup complete."
