# Film and media scripts

## Seeding a photo shoot

```bash
# <folder> contains the source images and a photos.csv next to them:
#   filename,title,taken_on
#   seal-01.jpg,The first cast,2026-03-14
#   seal-02.jpg,Finishing the buckle,       <- taken_on may be left blank

npx tsx scripts/seed-photos.ts <folder> "Set title"
```

For each photo: generates WebP renditions at 256/640/1280/2048 px (`sharp`,
a dev dependency used only by this local script — never shipped to the
client bundle) and a tiny, heavily-blurred placeholder inlined as a
`blur_data_url`, uploads everything to `site-media/photos/<set-id>/<media-id>/`,
and inserts one `photo_sets` row (`published = true`) plus one `media` +
`photos` row per photo, in the CSV's own order. Same `.env.local`/proxy
notes as uploading the film, above.

No real photo-shoot images yet? Generate a placeholder set first:

```bash
scripts/generate-placeholder-photos.sh <outdir> [count]   # default count: 8
npx tsx scripts/seed-photos.ts <outdir> "Placeholder shoot"
```

Writes `<outdir>/placeholder-NN.jpg` (solid colour + a number, via
ImageMagick's `convert`) and a matching `photos.csv`. Swap in the owner's
real images and a real `photos.csv` later — nothing else about the pipeline
changes.

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
