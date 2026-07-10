#!/usr/bin/env bash
# Copia i file condivisi da chrome/ verso firefox/ e safari/.
# Uso: bash tools/sync.sh   (dalla cartella principale della repo)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for B in firefox safari; do
  cp "$ROOT/chrome/content.js" "$ROOT/chrome/popup.html" "$ROOT/chrome/popup.js" "$ROOT/$B/"
  rm -rf "$ROOT/$B/images"
  cp -r "$ROOT/chrome/images" "$ROOT/$B/images"
  echo "sincronizzato: $B"
done
echo "Fatto. I manifest.json NON vengono toccati (sono diversi per ogni browser)."
