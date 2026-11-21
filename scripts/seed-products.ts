/**
 * Seeds one product — by default the Phase 3 dev/placeholder "Sample Belt
 * No.5" per phases/PHASE-3-shop-and-enquiry.md's own "Owner inputs needed"
 * fallback — with WebP renditions (256/640/1280/2048px) and a blur
 * placeholder, uploaded to site-media, plus products/product_media/media
 * rows.
 *
 * Usage: npx tsx scripts/seed-products.ts <folder> [--slug=x --name="Y"
 *   --price=40 --currency=GBP --description="..." --bullets="a|b"
 *   --zone=wall|floor --region=shop-wall|shop-floor --sort-order=0
 *   --node-x=N --node-y=N --node-width=N --node-height=N]
 *
 * With no flags, seeds exactly the original fixed dev product (unchanged
 * CI/local-dev behaviour) — flags only override individual fields, so a
 * second real product (e.g. the Shop Wall's own item) can reuse this same
 * script rather than a near-duplicate one.
 *
 * Bulk mode: add `--count=N` to insert N products in one run instead of
 * one, reusing <folder>'s own single source image for every one of them
 * (docs/decisions.md D-82 — this is "a real way to see 20+ today", not a
 * second real-photo importer; a real multi-product catalogue is still the
 * owner's own "owner inputs needed" item, AGENTS.md rule 10). --slug/--name
 * become the shared prefix ("bulk-belt" / "Bulk Belt" by default) — product
 * i gets slug `${prefix}-${i+1}` and name `${namePrefix} No.${i+1}`, with
 * `--sort-order` as the first item's own sort_order and each later one
 * incrementing by 1, so the whole batch orders after whatever already
 * exists. Every other flag (--price/--zone/--region/etc.) applies to the
 * whole batch alike. canvas_nodes positions aren't read for real layout any
 * more (see the comment on SAMPLE_PRODUCT.node below) — every bulk item
 * reuses the same base --node-x/--node-y, which is harmless for exactly
 * that reason.
 *
 * <folder> must contain at least one image file (jpg/jpeg/png/webp) — its
 * first file in directory order is used as the product's poster and its
 * only picture. A real multi-picture/video catalogue is Phase 3's own
 * "owner inputs needed" item, not guessed here (AGENTS.md rule 10); this
 * script seeds one product (or, in bulk mode, N identical-looking ones) per
 * run, not a general bulk importer like seed-photos.ts (which genuinely
 * needs to take many real shoots later).
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

const [, , folder, ...rest] = process.argv;

if (!folder) {
  console.error("Usage: npx tsx scripts/seed-products.ts <folder> [--key=value ...]");
  process.exit(1);
}
if (!existsSync(folder)) {
  console.error(`Folder not found: ${folder}`);
  process.exit(1);
}

const overrides = new Map<string, string>();
for (const arg of rest) {
  const match = /^--([a-z-]+)=(.*)$/.exec(arg);
  if (!match) {
    console.error(`Unrecognised argument: ${arg} (expected --key=value)`);
    process.exit(1);
  }
  overrides.set(match[1], match[2]);
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

const BULK_COUNT = overrides.has("count") ? Number(overrides.get("count")) : null;
if (BULK_COUNT !== null && (!Number.isInteger(BULK_COUNT) || BULK_COUNT < 1)) {
  console.error(`--count must be a positive integer, got: ${overrides.get("count")}`);
  process.exit(1);
}

// T2's two Shop regions both need at least one real product to render
// against — 'floor' per phases/PHASE-3-shop-and-enquiry.md T2's own
// description of it as the simpler, single-item-friendly layout ("items
// laid out" vs the wall's "hung or framed" treatment) — the default here,
// overridable via --zone/--region for a second run seeding the wall's own
// item. Unlike the collage's generative phyllotaxis layout (a real product
// display is curated, not algorithmic), so this script seeds the node's own
// position directly. Taller than wide: ShopRegion.tsx stacks a poster
// tile above the ProductLabel card within this one box. This node x/y is
// no longer read for real layout at all, though (docs/decisions.md D-71's
// "fourth correction" — ShopRoomScene.tsx lays products out with its own
// fixed CSS grid, keyed only by which region a node belongs to) — kept
// here only because `region`/`zone` still determine that bucket.
const SHARED = {
  priceAmount: Number(overrides.get("price") ?? 40),
  priceCurrency: overrides.get("currency") ?? "GBP",
  description: overrides.get("description") ?? "Black tyre belt with aluminium buckle.",
  bullets: overrides.has("bullets")
    ? overrides.get("bullets")!.split("|")
    : ["Belt made from repurposed bike tyre", "Buckle sand-cast using discarded aluminium"],
  zone: (overrides.get("zone") ?? "floor") as "wall" | "floor",
  region: overrides.get("region") ?? "shop-floor",
  node: {
    x: Number(overrides.get("node-x") ?? 1880),
    y: Number(overrides.get("node-y") ?? 2220),
    width: Number(overrides.get("node-width") ?? 240),
    height: Number(overrides.get("node-height") ?? 360),
  },
};
const baseSortOrder = Number(overrides.get("sort-order") ?? 0);

const itemsToSeed =
  BULK_COUNT === null
    ? [
        {
          slug: overrides.get("slug") ?? "sample-belt-no-5",
          name: overrides.get("name") ?? "Sample Belt No.5",
          sortOrder: baseSortOrder,
        },
      ]
    : Array.from({ length: BULK_COUNT }, (_, i) => ({
        slug: `${overrides.get("slug") ?? "bulk-belt"}-${i + 1}`,
        name: `${overrides.get("name") ?? "Bulk Belt"} No.${i + 1}`,
        sortOrder: baseSortOrder + i,
      }));

async function uploadBuffer(destPath: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from("site-media").upload(destPath, buffer, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload ${destPath}: ${error.message}`);
}

async function seedOne(item: { slug: string; name: string; sortOrder: number }, sourceBuffer: Buffer) {
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      slug: item.slug,
      name: item.name,
      price_amount: SHARED.priceAmount,
      price_currency: SHARED.priceCurrency,
      description: SHARED.description,
      bullets: SHARED.bullets,
      zone: SHARED.zone,
      published: true,
      sort_order: item.sortOrder,
    })
    .select()
    .single();
  if (productError || !product) {
    throw new Error(`Failed to insert products row for "${item.slug}": ${productError?.message}`);
  }

  const image = sharp(sourceBuffer);
  const metadata = await image.metadata();
  const mediaId = randomUUID();
  const storagePrefix = `products/${product.id}/${mediaId}`;
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

  const blurBuffer = await sharp(sourceBuffer).resize({ width: 16 }).blur().webp({ quality: 40 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString("base64")}`;

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .insert({
      kind: "image",
      storage_path: storagePrefix,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      alt_text: item.name,
      blur_data_url: blurDataUrl,
      renditions,
      status: "ready",
    })
    .select()
    .single();
  if (mediaError || !media) {
    throw new Error(`Failed to insert media row for "${item.slug}": ${mediaError?.message}`);
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ poster_media_id: media.id })
    .eq("id", product.id);
  if (updateError) {
    throw new Error(`Failed to set products.poster_media_id for "${item.slug}": ${updateError.message}`);
  }

  const { error: productMediaError } = await supabase
    .from("product_media")
    .insert({ product_id: product.id, media_id: media.id, kind: "picture", sort_order: 0 });
  if (productMediaError) {
    throw new Error(`Failed to insert product_media row for "${item.slug}": ${productMediaError.message}`);
  }

  const { error: nodeError } = await supabase.from("canvas_nodes").insert({
    region: SHARED.region,
    node_type: "product",
    ref_table: "products",
    ref_id: product.id,
    x: SHARED.node.x,
    y: SHARED.node.y,
    width: SHARED.node.width,
    height: SHARED.node.height,
    published: true,
  });
  if (nodeError) {
    throw new Error(`Failed to insert canvas_nodes row for "${item.slug}": ${nodeError.message}`);
  }

  console.log(`Inserted "${item.name}" (${product.id}), sort_order ${item.sortOrder}, zone "${SHARED.zone}".`);
}

async function main() {
  const imageFiles = readdirSync(folder)
    .filter((f) => IMAGE_EXTENSIONS.has(extname(f).toLowerCase()))
    .sort();
  if (imageFiles.length === 0) {
    console.error(`No image files (jpg/jpeg/png/webp) found in ${folder}`);
    process.exit(1);
  }
  const sourceBuffer = readFileSync(join(folder, imageFiles[0]));

  for (const item of itemsToSeed) {
    await seedOne(item, sourceBuffer);
  }

  console.log(
    `Done. Seeded ${itemsToSeed.length} product${itemsToSeed.length === 1 ? "" : "s"} in region "${SHARED.region}".`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
