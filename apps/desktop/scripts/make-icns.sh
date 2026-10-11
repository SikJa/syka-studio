#!/bin/sh
# Regenerates syka-assets/icon.icns from syka-assets/icon.png (1024x1024).
# Replace syka-assets/icon.png and run: npm run make:icns
set -e
cd "$(dirname "$0")/.."

ICONSET="$(mktemp -d)/icon.iconset"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  d=$((s * 2))
  sips -z "$s" "$s" syka-assets/icon.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z "$d" "$d" syka-assets/icon.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o syka-assets/icon.icns
rm -rf "$(dirname "$ICONSET")"
echo "wrote syka-assets/icon.icns"
