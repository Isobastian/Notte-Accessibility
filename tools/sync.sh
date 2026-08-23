#!/usr/bin/env bash
# Copy the shared files from chrome/ into firefox/ and safari/.
# Usage: bash tools/sync.sh   (run from the repository root)
#
# Only manifest.json differs per browser, so it is NEVER copied here.
# Everything else (the engine, the popup, the icons) has a single master
# copy in chrome/ and is mirrored into firefox/ and safari/ by this script.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for B in firefox safari; do
  cp "$ROOT/chrome/content.js" \
     "$ROOT/chrome/shadow-patch.js" \
     "$ROOT/chrome/background.js" \
     "$ROOT/chrome/popup.html" \
     "$ROOT/chrome/popup.js" \
     "$ROOT/$B/"
  # NB: do NOT use `rm -rf images && cp -r chrome/images images`: if the rm fails
  # (permissions, mounted filesystems...) the `cp -r` ends up copying INTO the
  # existing folder, creating `images/images/` (duplicate icons that bloat the
  # zip). Copy the individual files instead: never a dir inside a dir.
  mkdir -p "$ROOT/$B/images"
  rm -f "$ROOT/$B/images/"*.png
  cp "$ROOT/chrome/images/"*.png "$ROOT/$B/images/"
  echo "synced: $B"
done
echo "Done. The manifest.json files are NOT touched (they differ per browser)."
