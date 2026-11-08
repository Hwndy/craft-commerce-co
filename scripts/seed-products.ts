/**
 * Seeds the Phase 3 dev/placeholder product — Sample Belt No.5, per
 * phases/PHASE-3-shop-and-enquiry.md's own "Owner inputs needed" fallback
 * — with WebP renditions (256/640/1280/2048px) and a blur placeholder,
 * uploaded to site-media, plus products/product_media/media rows.
 *
 * Usage: npx tsx scripts/seed-products.ts <folder>
 *
 * <folder> must contain at least one image file (jpg/jpeg/png/webp) — its
 * first file in directory order is used as the product's poster and its
 * only picture. A real multi-picture/video catalogue is Phase 3's own
 * "owner inputs needed" item, not guessed here (AGENTS.md rule 10); this
 * script seeds one fixed dev product, not a general bulk importer like
 * seed-photos.ts (which genuinely needs to take many real shoots later).
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

const [, , folder] = process.argv;

if (!folder) {
  console.error("Usage: npx tsx scripts/seed-products.ts <folder>");
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

const SAMPLE_PRODUCT = {
  slug: "sample-belt-no-5",
  name: "Sample Belt No.5",
  priceAmount: 40,
  priceCurrency: "GBP",
  description: "Black tyre belt with aluminium buckle.",
  bullets: ["Belt made from repurposed bike tyre", "Buckle sand-cast using discarded aluminium"],
  // T2's two Shop regions both need at least one real product to render
  // against — 'floor' per phases/PHASE-3-shop-and-enquiry.md T2's own
  // description of it as the simpler, single-item-friendly layout ("items
  // laid out" vs the wall's "hung or framed" treatment).
  zone: "floor" as const,
  // Unlike the collage's generative phyllotaxis layout (a real product
  // display is curated, not algorithmic), so this script seeds the node's
  // own position directly — centred on supabase/seed.sql's 'shop-floor'
  // viewpoint (-2000, 1200). Taller than wide: ShopRegion.tsx stacks a
  // poster tile above the ProductLabel card within this one box.
  region: "shop-floor",
  node: { x: -2120, y: 1020, width: 240, height: 360 },
};

async function uploadBuffer(destPath: string, buffer: Buffer, contentType: string) {
  const { error } = await supabase.storage.from("site-media").upload(destPath, buffer, {
    contentType,
    cacheControl: "public, max-age=31536000, immutable",
    upsert: true,
  });
  if (error) throw new Error(`Failed to upload ${destPath}: ${error.message}`);
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

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      slug: SAMPLE_PRODUCT.slug,
      name: SAMPLE_PRODUCT.name,
      price_amount: SAMPLE_PRODUCT.priceAmount,
      price_currency: SAMPLE_PRODUCT.priceCurrency,
      description: SAMPLE_PRODUCT.description,
      bullets: SAMPLE_PRODUCT.bullets,
      zone: SAMPLE_PRODUCT.zone,
      published: true,
      sort_order: 0,
    })
    .select()
    .single();
  if (productError || !product) {
    throw new Error(`Failed to insert products row: ${productError?.message}`);
  }
  console.log(`Inserted products row ${product.id} ("${SAMPLE_PRODUCT.name}")`);

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
      alt_text: SAMPLE_PRODUCT.name,
      blur_data_url: blurDataUrl,
      renditions,
      status: "ready",
    })
    .select()
    .single();
  if (mediaError || !media) {
    throw new Error(`Failed to insert media row: ${mediaError?.message}`);
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ poster_media_id: media.id })
    .eq("id", product.id);
  if (updateError) {
    throw new Error(`Failed to set products.poster_media_id: ${updateError.message}`);
  }

  const { error: productMediaError } = await supabase
    .from("product_media")
    .insert({ product_id: product.id, media_id: media.id, kind: "picture", sort_order: 0 });
  if (productMediaError) {
    throw new Error(`Failed to insert product_media row: ${productMediaError.message}`);
  }

  const { error: nodeError } = await supabase.from("canvas_nodes").insert({
    region: SAMPLE_PRODUCT.region,
    node_type: "product",
    ref_table: "products",
    ref_id: product.id,
    x: SAMPLE_PRODUCT.node.x,
    y: SAMPLE_PRODUCT.node.y,
    width: SAMPLE_PRODUCT.node.width,
    height: SAMPLE_PRODUCT.node.height,
    published: true,
  });
  if (nodeError) {
    throw new Error(`Failed to insert canvas_nodes row for the product: ${nodeError.message}`);
  }

  console.log(`  ${imageFiles[0]} -> media ${media.id} (${Object.keys(renditions).length} renditions)`);
  console.log(
    `Done. Product "${SAMPLE_PRODUCT.name}" (${product.id}), zone "${SAMPLE_PRODUCT.zone}", node in region "${SAMPLE_PRODUCT.region}".`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
