# Film and media scripts

## Encoding the film

```bash
scripts/encode-hls.sh <input.mp4> <outdir>
```

Produces an adaptive HLS ladder (360p/720p/1080p H.264+AAC, 6 s VOD segments),
`master.m3u8`, a poster JPEG at 10% of the duration, and a scrub-bar sprite
sheet (`sprite.jpg` + `sprite.json`, one thumbnail every 5 s, 10×10 tiles).
Requires `ffmpeg`/`ffprobe` on `PATH`.

## Uploading the film

```bash
# .env.local (git-ignored):
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...   (never commit this)

npx tsx scripts/upload-film.ts <outdir> "Film title"
```

In a Claude Code cloud session behind the agent proxy, Node's own `fetch`
(what `@supabase/supabase-js` uses) doesn't read `HTTPS_PROXY` by default —
prefix the command with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) or credential
injection for the project host won't apply. Not needed outside that
environment.

Uploads every file in `<outdir>` to the `site-media` bucket under
`film/<new-media-id>/`, with `application/vnd.apple.mpegurl` for playlists and
`video/mp2t` for segments, a long immutable cache for segments/poster/sprite
and a short one for playlists. Then inserts one `media` row (`kind = 'hls'`,
`status = 'ready'`) and one `gallery_film` row (`published = true`,
`version = 1`).

## Replacing the film later

1. Re-run `encode-hls.sh` on the new source into a fresh output directory.
2. Run `upload-film.ts` again — it inserts a **new** `media`/`gallery_film`
   row rather than overwriting the old one in place.
3. In the admin (Phase 4) or directly in the database: unpublish the old
   `gallery_film` row, publish the new one, and bump `version` so returning
   visitors see the first-watch gate again (D-07).
4. Leave the old media's storage files in place until you're sure the new
   film works end to end, then delete them to reclaim storage.
