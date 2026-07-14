#!/usr/bin/env bash
# Copia i file condivisi da chrome/ verso firefox/ e safari/.
# Uso: bash tools/sync.sh   (dalla cartella principale della repo)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for B in firefox safari; do
  cp "$ROOT/chrome/content.js" "$ROOT/chrome/shadow-patch.js" "$ROOT/chrome/popup.html" "$ROOT/chrome/popup.js" "$ROOT/$B/"
  # NB: NON usare `rm -rf images && cp -r chrome/images images`: se il rm non va
  # a buon fine (permessi, filesystem montati...) il cp -r finisce per copiare
  # DENTRO la cartella esistente creando `images/images/` (icone duplicate che
  # gonfiavano lo zip). Copiamo invece i singoli file: mai una dir dentro una dir.
  mkdir -p "$ROOT/$B/images"
  rm -f "$ROOT/$B/images/"*.png
  cp "$ROOT/chrome/images/"*.png "$ROOT/$B/images/"
  echo "sincronizzato: $B"
done
echo "Fatto. I manifest.json NON vengono toccati (sono diversi per ogni browser)."
