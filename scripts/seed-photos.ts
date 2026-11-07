/**
 * Seeds a photo shoot: WebP renditions (256/640/1280/2048px), a tiny blur
 * placeholder, uploaded to site-media, plus photo_sets/photos/media rows.
 *
 * Usage: npx tsx scripts/seed-photos.ts <folder> "<Set title>"
 *
 * <folder> must contain the source images and a photos.csv next to them:
 *   filename,title,taken_on
 *   seal-01.jpg,The first cast,2026-03-14
 *   seal-02.jpg,Finishing the buckle,
 *
 * taken_on is optional (YYYY-MM-DD) and may be left blank. Rows are
 * inserted in the CSV's own order (photos.sort_order follows it).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local. Never
 * commit a real value for either; the service-role key is local-script-only
 * per AGENTS.md rule 4. Uses sharp — a local-script-only dev dependency
 * (docs/decisions.md), never shipped to the client bundle.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";

loadEnv({ path: ".env.local" });

const [, , folder, setTitleArg] = process.argv;

if (!folder || !setTitleArg) {
  console.error('Usage: npx tsx scripts/seed-photos.ts <folder> "<Set title>"');
  process.exit(1);
}
if (!existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
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

const RENDITION_WIDTHS = [256, 640, 1280, 2048] as const;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

interface PhotoRow {
  filename: string;
  title: string;
  takenOn: string | null;
}

/** Minimal CSV: no quoted-field escaping needed for this fixed 3-column shape. */
function parsePhotosCsv(csvPath: string): PhotoRow[] {
  const lines = readFileSync(csvPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const [header, ...rows] = lines;
  const columns = header.split(",").map((c) => c.trim().toLowerCase());
  const filenameIdx = columns.indexOf("filename");
  const titleIdx = columns.indexOf("title");
  const takenOnIdx = columns.indexOf("taken_on");
  if (filenameIdx === -1 || titleIdx === -1) {
    throw new Error(`photos.csv must have at least "filename" and "title" columns, got: ${header}`);
  }

  return rows.map((row) => {
    const cells = row.split(",").map((c) => c.trim());
    const takenOn = takenOnIdx !== -1 ? cells[takenOnIdx] : "";
    return {
      filename: cells[filenameIdx],
      title: cells[titleIdx],
      takenOn: takenOn ? takenOn : null,
    };
  });
}

async function uploadBuffer(destPath: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from("site-media").upload(destPath, buffer, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload ${destPath}: ${error.message}`);
}

async function main() {
  const csvPath = join(folder, "photos.csv");
  if (!existsSync(csvPath)) {
    console.error(`photos.csv not found in ${folder}`);
    process.exit(1);
  }
  const rows = parsePhotosCsv(csvPath);
  if (rows.length === 0) {
    console.error("photos.csv has no rows.");
    process.exit(1);
  }

  const available = new Set(readdirSync(folder).filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase())));
  for (const row of rows) {
    if (!available.has(row.filename)) {
      throw new Error(`photos.csv references "${row.filename}", which isn't in ${folder}`);
    }
  }

  const { data: photoSet, error: setError } = await supabase
    .from("photo_sets")
    .insert({ title: setTitleArg, published: true, sort_order: 0 })
    .select()
    .single();
  if (setError || !photoSet) {
    throw new Error(`Failed to insert photo_sets row: ${setError?.message}`);
  }
  console.log(`Inserted photo_sets row ${photoSet.id} ("${setTitleArg}")`);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourcePath = join(folder, row.filename);
    const sourceBuffer = readFileSync(sourcePath);
    const image = sharp(sourceBuffer);
    const metadata = await image.metadata();

    const mediaId = randomUUID();
    const storagePrefix = `photos/${photoSet.id}/${mediaId}`;
    const renditions: Record<string, string> = {};

    for (const width of RENDITION_WIDTHS) {
      const resized = await sharp(sourceBuffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const destPath = `${storagePrefix}/${width}.webp`;
      await uploadBuffer(destPath, resized, "image/webp");
      renditions[String(width)] = destPath;
    }

    // Tiny, heavily-blurred placeholder, inlined as a data URL (no network
    // round-trip needed before the real thumbnail loads).
    const blurBuffer = await sharp(sourceBuffer)
      .resize({ width: 16 })
      .blur()
      .webp({ quality: 40 })
      .toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .insert({
        kind: "image",
        storage_path: storagePrefix,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        alt_text: row.title,
        blur_data_url: blurDataUrl,
        renditions,
        status: "ready",
      })
      .select()
      .single();
    if (mediaError || !media) {
      throw new Error(`Failed to insert media row for ${row.filename}: ${mediaError?.message}`);
    }

    const { error: photoError } = await supabase.from("photos").insert({
      set_id: photoSet.id,
      media_id: media.id,
      title: row.title,
      taken_on: row.takenOn,
      sort_order: i,
    });
    if (photoError) {
      throw new Error(`Failed to insert photos row for ${row.filename}: ${photoError.message}`);
    }

    console.log(`  ${row.filename} -> media ${media.id} (${Object.keys(renditions).length} renditions)`);
  }

  console.log(`Done. ${rows.length} photo(s) in set "${setTitleArg}" (${photoSet.id}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
