#!/usr/bin/env bash
# Generates a short synthetic test video for dev/CI use, per
# docs/05-testing-and-quality.md §2. Not the real film — used so T13's
# gate/entry-sequence Playwright specs don't need to wait through a real
# multi-minute film to watch it through.
#
# Usage: scripts/generate-test-film.sh <outfile.mp4> [duration_seconds]
set -euo pipefail

OUTFILE="${1:-}"
DURATION="${2:-20}"

if [[ -z "$OUTFILE" ]]; then
  echo "Usage: scripts/generate-test-film.sh <outfile.mp4> [duration_seconds]" >&2
  exit 1
fi

ffmpeg -y \
  -f lavfi -i "testsrc2=size=1280x720:rate=24" \
  -f lavfi -i "sine=frequency=440" \
  -t "$DURATION" \
  -pix_fmt yuv420p \
  -c:v libx264 -preset veryfast \
  -c:a aac \
  "$OUTFILE" \
  < /dev/null

echo "Wrote $OUTFILE (${DURATION}s synthetic test film)"
