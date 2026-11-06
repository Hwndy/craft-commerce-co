/**
 * Uploads an HLS-encoded film (produced by scripts/encode-hls.sh) to the
 * site-media bucket and inserts the media + gallery_film rows.
 *
 * Usage: npx tsx scripts/upload-film.ts <hls-dir> "<Film title>"
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local. Never
 * commit a real value for either; the service-role key is local-script-only
 * per AGENTS.md rule 4.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const [, , hlsDir, titleArg] = process.argv;

if (!hlsDir || !titleArg) {
  console.error('Usage: npx tsx scripts/upload-film.ts <hls-dir> "<Film title>"');
  process.exit(1);
}
if (!existsSync(hlsDir)) {
  console.error(`HLS directory not found: ${hlsDir}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local (git-ignored)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

// Immutable segments/images cache for a year; playlists get a short cache
// since they can be regenerated (and the master/variant lists stay small).
function cacheControlFor(ext: string): string {
  return ext === ".m3u8" ? "public, max-age=60" : "public, max-age=31536000, immutable";
}

function listFilesRecursive(dir: string, base = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(full, base));
    } else {
      files.push(full);
    }
  }
  return files;
}

function probeDurationSeconds(inputDir: string): number | null {
  // Best effort: ffprobe one of the variant playlists if ffprobe is present.
  const master = join(inputDir, "master.m3u8");
  if (!existsSync(master)) return null;
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", master],
      { encoding: "utf8" }
    ).trim();
    const value = Number.parseFloat(out);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function main() {
  const mediaId = randomUUID();
  const storagePrefix = `film/${mediaId}`;

  const files = listFilesRecursive(hlsDir);
  console.log(`Uploading ${files.length} files to site-media/${storagePrefix}/...`);

  for (const filePath of files) {
    const relative = filePath.slice(hlsDir.length + 1).split(/\\|\//).join("/");
    const ext = extname(filePath);
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    const cacheControl = cacheControlFor(ext);
    const body = readFileSync(filePath);
    const destPath = `${storagePrefix}/${relative}`;

    const { error } = await supabase.storage.from("site-media").upload(destPath, body, {
      contentType,
      cacheControl,
      upsert: true,
    });
    if (error) {
      throw new Error(`Failed to upload ${destPath}: ${error.message}`);
    }
    console.log(`  uploaded ${destPath} (${(statSync(filePath).size / 1024).toFixed(0)} KB)`);
  }

  let spriteMeta: Record<string, number> | null = null;
  const spriteJsonPath = join(hlsDir, "sprite.json");
  if (existsSync(spriteJsonPath)) {
    spriteMeta = JSON.parse(readFileSync(spriteJsonPath, "utf8"));
  }

  const durationS = probeDurationSeconds(hlsDir);

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .insert({
      kind: "hls",
      storage_path: storagePrefix,
      hls_master: `${storagePrefix}/master.m3u8`,
      poster_path: existsSync(join(hlsDir, "poster.jpg")) ? `${storagePrefix}/poster.jpg` : null,
      sprite_path: existsSync(join(hlsDir, "sprite.jpg")) ? `${storagePrefix}/sprite.jpg` : null,
      sprite_meta: spriteMeta,
      width: 1920,
      height: 1080,
      duration_s: durationS,
      status: "ready",
    })
    .select()
    .single();

  if (mediaError || !media) {
    throw new Error(`Failed to insert media row: ${mediaError?.message}`);
  }
  console.log(`Inserted media row ${media.id}`);

  const { data: film, error: filmError } = await supabase
    .from("gallery_film")
    .insert({
      media_id: media.id,
      title: titleArg,
      version: 1,
      published: true,
    })
    .select()
    .single();

  if (filmError || !film) {
    throw new Error(`Failed to insert gallery_film row: ${filmError?.message}`);
  }
  console.log(`Inserted gallery_film row ${film.id} (published, version 1)`);
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
