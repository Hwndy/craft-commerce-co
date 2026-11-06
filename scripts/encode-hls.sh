#!/usr/bin/env bash
# Encode a source film into an adaptive HLS ladder (360p/720p/1080p H.264+AAC),
# a poster frame and a scrub-bar sprite sheet, per docs/02-canvas-spec.md and
# phases/PHASE-1-entry-to-film.md T4.
#
# Usage: scripts/encode-hls.sh <input.mp4> <outdir>
set -euo pipefail

INPUT="${1:-}"
OUTDIR="${2:-}"

if [[ -z "$INPUT" || -z "$OUTDIR" ]]; then
  echo "Usage: scripts/encode-hls.sh <input.mp4> <outdir>" >&2
  exit 1
fi
if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

SEGMENT_SECONDS=6
# name:height:resolution:video_bitrate:audio_bitrate
RENDITIONS=(
  "360p:360:640x360:800k:96k"
  "720p:720:1280x720:2800k:128k"
  "1080p:1080:1920x1080:5000k:160k"
)

for rung in "${RENDITIONS[@]}"; do
  IFS=':' read -r name height resolution vbitrate abitrate <<< "$rung"
  mkdir -p "$OUTDIR/$name"
  vbps="${vbitrate%k}000"
  bufsize="$(( vbps * 2 / 1000 ))k"
  echo "Encoding $name ($resolution, $vbitrate)..."
  ffmpeg -y -i "$INPUT" \
    -vf "scale=-2:${height}" \
    -c:v libx264 -profile:v main -preset veryfast \
    -b:v "$vbitrate" -maxrate "$vbitrate" -bufsize "$bufsize" \
    -force_key_frames "expr:gte(t,n_forced*${SEGMENT_SECONDS})" \
    -c:a aac -b:a "$abitrate" -ac 2 \
    -hls_time "$SEGMENT_SECONDS" -hls_playlist_type vod \
    -hls_segment_filename "$OUTDIR/$name/segment_%04d.ts" \
    "$OUTDIR/$name/playlist.m3u8" \
    < /dev/null
done

MASTER="$OUTDIR/master.m3u8"
{
  echo "#EXTM3U"
  echo "#EXT-X-VERSION:3"
  for rung in "${RENDITIONS[@]}"; do
    IFS=':' read -r name height resolution vbitrate abitrate <<< "$rung"
    bandwidth="${vbitrate%k}000"
    echo "#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}"
    echo "${name}/playlist.m3u8"
  done
} > "$MASTER"
echo "Wrote $MASTER"

DURATION="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
POSTER_TIME="$(awk "BEGIN { printf \"%.2f\", $DURATION * 0.10 }")"
ffmpeg -y -ss "$POSTER_TIME" -i "$INPUT" -frames:v 1 -update 1 -q:v 2 "$OUTDIR/poster.jpg" < /dev/null
echo "Wrote $OUTDIR/poster.jpg"

SPRITE_INTERVAL=5
SPRITE_COLS=10
SPRITE_ROWS=10
SPRITE_W=160
SPRITE_H=90
ffmpeg -y -i "$INPUT" \
  -vf "fps=1/${SPRITE_INTERVAL},scale=${SPRITE_W}:${SPRITE_H},tile=${SPRITE_COLS}x${SPRITE_ROWS}" \
  -frames:v 1 -update 1 "$OUTDIR/sprite.jpg" \
  < /dev/null
cat > "$OUTDIR/sprite.json" <<JSON
{"cols": ${SPRITE_COLS}, "rows": ${SPRITE_ROWS}, "w": ${SPRITE_W}, "h": ${SPRITE_H}, "interval": ${SPRITE_INTERVAL}}
JSON
echo "Wrote $OUTDIR/sprite.jpg and $OUTDIR/sprite.json"

echo "Done. Output in $OUTDIR"
