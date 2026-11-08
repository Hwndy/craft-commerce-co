import { z } from "zod";

import { supabase } from "@/lib/supabase";

export const PRODUCTS_QUERY_KEY = ["shop", "products"] as const;
export const PRODUCT_QUERY_KEY = (slug: string) => ["shop", "product", slug] as const;

const mediaSchema = z.object({
  id: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  blurDataUrl: z.string().nullable(),
  renditions: z.record(z.string()),
});
export type ProductMedia = z.infer<typeof mediaSchema>;

const productSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  priceAmount: z.number(),
  priceCurrency: z.string(),
  description: z.string().nullable(),
  bullets: z.array(z.string()),
  status: z.enum(["available", "sold", "made_to_order"]),
  zone: z.enum(["wall", "floor"]),
  onSale: z.boolean(),
  poster: mediaSchema.nullable(),
});
export type Product = z.infer<typeof productSchema>;

const productDetailSchema = productSchema.extend({
  // The overlay's picture gallery (T3) — ordered, product_media rows of
  // kind 'picture'. Separate from `poster`, which is the board/ProductLabel
  // thumbnail and the turntable video's poster frame.
  pictures: z.array(mediaSchema),
  video: mediaSchema.nullable(),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

interface MediaRow {
  id: string;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  renditions: unknown;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price_amount: number;
  price_currency: string;
  description: string | null;
  bullets: unknown;
  status: string;
  zone: string;
  on_sale: boolean;
  poster_media_id: string | null;
  video_media_id: string | null;
}

function mapMedia(row: MediaRow | undefined): ProductMedia | null {
  if (!row) return null;
  return mediaSchema.parse({
    id: row.id,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blur_data_url,
    renditions: row.renditions ?? {},
  });
}

/** Pure, unit-testable: maps raw Supabase rows into a Zod-validated Product. */
export function mapProductRow(row: ProductRow, mediaById: Map<string, MediaRow>): Product {
  return productSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    description: row.description,
    bullets: row.bullets,
    status: row.status,
    zone: row.zone,
    onSale: row.on_sale,
    poster: mapMedia(row.poster_media_id ? mediaById.get(row.poster_media_id) : undefined),
  });
}

/** Every published product, in `sort_order` (FR-4.1, FR-4.2). */
export async function fetchProducts(): Promise<Product[]> {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("published", true)
    .order("sort_order")
    .order("id");
  if (productsError) throw productsError;
  if (!products || products.length === 0) return [];

  const posterIds = products.map((p) => p.poster_media_id).filter((id): id is string => id != null);
  const mediaById = await fetchMediaByIds(posterIds);

  return products.map((row) => mapProductRow(row, mediaById));
}

/** A single published product by slug, with its full picture gallery and
 * turntable video, for the product overlay (FR-4.3–FR-4.5). `null` if no
 * published product has that slug. */
export async function fetchProduct(slug: string): Promise<ProductDetail | null> {
  const { data: row, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (productError) throw productError;
  if (!row) return null;

  const { data: productMedia, error: productMediaError } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", row.id)
    .order("sort_order");
  if (productMediaError) throw productMediaError;

  const mediaIds = [
    row.poster_media_id,
    row.video_media_id,
    ...(productMedia ?? []).map((pm) => pm.media_id),
  ].filter((id): id is string => id != null);
  const mediaById = await fetchMediaByIds(mediaIds);

  const pictures = (productMedia ?? [])
    .filter((pm) => pm.kind === "picture")
    .map((pm) => mapMedia(mediaById.get(pm.media_id)))
    .filter((m): m is ProductMedia => m !== null);

  return productDetailSchema.parse({
    ...mapProductRow(row, mediaById),
    pictures,
    video: mapMedia(row.video_media_id ? mediaById.get(row.video_media_id) : undefined),
  });
}

async function fetchMediaByIds(ids: string[]): Promise<Map<string, MediaRow>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.from("media").select("*").in("id", uniqueIds).eq("status", "ready");
  if (error) throw error;
  return new Map((data ?? []).map((m) => [m.id, m]));
}
