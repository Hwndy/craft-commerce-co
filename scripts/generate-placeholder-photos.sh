#!/usr/bin/env bash
# Generates a small set of placeholder photos + a matching photos.csv, so
# scripts/seed-photos.ts (and T8/T9/T11's collage/viewer work) have real
# data to render and test against before the owner supplies real
# photo-shoot images — same spirit as scripts/generate-test-film.sh.
#
# Usage: scripts/generate-placeholder-photos.sh <outdir> [count]
set -euo pipefail

OUTDIR="${1:-}"
COUNT="${2:-8}"

if [[ -z "$OUTDIR" ]]; then
  echo "Usage: scripts/generate-placeholder-photos.sh <outdir> [count]" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

# A small palette so placeholders are visually distinct, not identical tiles.
COLORS=(
  "#C9A64B" "#7FD8E6" "#8A3324" "#2E4057"
  "#D4AF37" "#5B8C5A" "#A14A76" "#3C3C3C"
)

echo "filename,title,taken_on" > "$OUTDIR/photos.csv"

for ((i = 1; i <= COUNT; i++)); do
  color_index=$(((i - 1) % ${#COLORS[@]}))
  color="${COLORS[$color_index]}"
  filename=$(printf "placeholder-%02d.jpg" "$i")
  title="Placeholder photo $i"
  # Spread fake dates across a few days so sorting/display has something
  # to show; owner replaces all of this with the real shoot's photos.csv.
  taken_on=$(date -u -d "-$((COUNT - i)) days" +%Y-%m-%d 2>/dev/null || date -u -v-"$((COUNT - i))"d +%Y-%m-%d)

  convert -size 2000x1500 "xc:${color}" \
    -gravity center -pointsize 64 -fill white -font DejaVu-Sans-Bold \
    -annotate 0 "Photo ${i}" \
    "$OUTDIR/$filename"

  echo "${filename},${title},${taken_on}" >> "$OUTDIR/photos.csv"
  echo "Wrote $OUTDIR/$filename"
done

echo "Wrote $OUTDIR/photos.csv (${COUNT} placeholder photos)"
