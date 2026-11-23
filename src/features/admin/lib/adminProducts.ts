import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

import { useOptimisticMutation } from "./useOptimisticMutation";

export const ADMIN_PRODUCTS_QUERY_KEY = ["admin", "products"] as const;

export type ProductStatus = Database["public"]["Enums"]["product_status"];
export type ProductZone = Database["public"]["Enums"]["product_zone"];

export interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  priceAmount: number;
  priceCurrency: string;
  description: string | null;
  bullets: string[];
  status: ProductStatus;
  zone: ProductZone;
  onSale: boolean;
  sortOrder: number;
  posterMediaId: string | null;
  videoMediaId: string | null;
  published: boolean;
}

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

function mapRow(row: ProductRow): AdminProductRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    description: row.description,
    bullets: Array.isArray(row.bullets) ? (row.bullets as unknown[]).map(String) : [],
    status: row.status,
    zone: row.zone,
    onSale: row.on_sale,
    sortOrder: row.sort_order,
    posterMediaId: row.poster_media_id,
    videoMediaId: row.video_media_id,
    published: row.published,
  };
}

/** Lowercase, `[a-z0-9]+` runs joined by `-`, trimmed — the same shape
 * scripts/seed-products.ts's own hand-picked slugs already follow, just
 * derived from a real name instead of typed by hand. Pure and unit-tested
 * on its own, same spirit as queries.ts's mapProductRow. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** attempt 0 is the bare slug; every attempt after appends a 1-indexed
 * numeric suffix starting at -2, so a second "Sample Belt" doesn't collide
 * with the first (not "-1", which would read as if a first attempt had
 * already failed when it hadn't). */
export function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

/** products.slug has a real unique constraint (migration 0003) — this is
 * the one Postgres error code that means "that candidate's taken," not a
 * network/permissions/validation failure worth giving up on immediately. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

/** zone (the admin-facing, product-level concept) to region (the
 * canvas_nodes-level bucket ShopRegion.tsx's two useProductNodes() calls
 * key off) — the only two values either side has ever had. */
export function regionForZone(zone: ProductZone): "shop-wall" | "shop-floor" {
  return zone === "wall" ? "shop-wall" : "shop-floor";
}

const MAX_SLUG_ATTEMPTS = 20;

/** Placeholder canvas_nodes geometry for every new product — D-85's "fourth
 * correction": these columns aren't read for real layout any more
 * (ShopRoomScene.tsx uses its own fixed CSS grid, keyed only by region), so
 * this is the same safe, arbitrary value scripts/seed-products.ts's own
 * SHARED.node already uses, not a number anyone will ever read. Kept here,
 * not in the migration (0010_admin_product_write_rpcs.sql), so this stays
 * the one place it lives. */
const PLACEHOLDER_NODE_GEOMETRY = { x: 1880, y: 2220, width: 240, height: 360 } as const;

/** Each attempt is one call to the migration 0010 RPC — already atomic on
 * its own (product + canvas_nodes insert in one server-side transaction) —
 * retried client-side only on a real Postgres unique-violation (`23505`)
 * against products.slug's own unique constraint, same retry shape as
 * before this task's RPC migration. */
async function insertProductWithUniqueSlug(
  baseSlug: string,
  input: CreateProductInput,
  sortOrder: number
): Promise<ProductRow> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc("create_product_with_node", {
      p_slug: slugCandidate(baseSlug, attempt),
      p_name: input.name,
      p_price_amount: input.priceAmount,
      p_description: input.description,
      p_bullets: input.bullets,
      p_status: input.status,
      p_zone: input.zone,
      p_on_sale: input.onSale,
      p_sort_order: sortOrder,
      p_region: regionForZone(input.zone),
      p_node_x: PLACEHOLDER_NODE_GEOMETRY.x,
      p_node_y: PLACEHOLDER_NODE_GEOMETRY.y,
      p_node_width: PLACEHOLDER_NODE_GEOMETRY.width,
      p_node_height: PLACEHOLDER_NODE_GEOMETRY.height,
    });
    if (!error) return data;
    if (!isUniqueViolation(error)) throw error;
  }
  throw new Error(`Couldn't find a free slug for "${baseSlug}" after ${MAX_SLUG_ATTEMPTS} attempts.`);
}

async function updateProductWithUniqueSlug(input: UpdateProductInput, baseSlug: string): Promise<ProductRow> {
  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase.rpc("update_product_with_node", {
      p_id: input.id,
      p_slug: slugCandidate(baseSlug, attempt),
      p_name: input.name,
      p_price_amount: input.priceAmount,
      p_description: input.description,
      p_bullets: input.bullets,
      p_status: input.status,
      p_zone: input.zone,
      p_on_sale: input.onSale,
      p_published: input.published,
      p_poster_media_id: input.posterMediaId,
      p_video_media_id: input.videoMediaId,
      p_region: regionForZone(input.zone),
    });
    if (!error) return data;
    if (!isUniqueViolation(error)) throw error;
  }
  throw new Error(`Couldn't find a free slug for "${baseSlug}" after ${MAX_SLUG_ATTEMPTS} attempts.`);
}

/** Every product, published or not — unlike shop/lib/queries.ts's public
 * fetchProducts(), which only ever returns published ones. The admin list
 * needs to see and manage drafts too. */
export function useAdminProducts() {
  return useQuery({
    queryKey: ADMIN_PRODUCTS_QUERY_KEY,
    queryFn: async (): Promise<AdminProductRow[]> => {
      const { data, error } = await supabase.from("products").select("*").order("sort_order").order("id");
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

/** `products.sort_order` defaults to 0 — without this, every newly created
 * product shared that default, so reorderSwap() (both ends already at 0)
 * wrote the same value back to both rows and the up/down buttons silently
 * did nothing for any product created after the first (found in review,
 * CodeRabbit, PR #38). New products go to the end of the real order
 * instead, one past whatever the current highest sort_order is. */
async function nextSortOrder(): Promise<number> {
  const { data, error } = await supabase
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export interface CreateProductInput {
  name: string;
  priceAmount: number;
  description: string | null;
  bullets: string[];
  status: ProductStatus;
  zone: ProductZone;
  onSale: boolean;
}

/** Creates the bare product row (no media fields yet — AdminProducts.tsx's
 * two-step create flow fills those in once the product, and so its real
 * id/storage prefix, exists) plus the canvas_nodes row that makes it
 * actually show up in the room (fetchProductNodes() joins on this — see
 * docs/decisions.md D-85). Both inserts happen inside the migration 0010
 * `create_product_with_node` RPC, in one server-side transaction: a failed
 * node insert now rolls back the product insert automatically (real
 * atomicity, not a client-side compensating delete that could itself fail
 * — the gap this RPC was built to close, docs/decisions.md D-85's "Update"
 * section and the follow-up migration). */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput): Promise<AdminProductRow> => {
      const baseSlug = slugify(input.name) || "product";
      const sortOrder = await nextSortOrder();
      const product = await insertProductWithUniqueSlug(baseSlug, input, sortOrder);
      return mapRow(product);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<AdminProductRow[]>(ADMIN_PRODUCTS_QUERY_KEY, (previous) => [
        ...(previous ?? []),
        created,
      ]);
    },
    onError: () => {
      toast("Couldn't create the product — please try again.");
    },
  });
}

export interface UpdateProductInput {
  id: string;
  name: string;
  slug: string;
  priceAmount: number;
  description: string | null;
  bullets: string[];
  status: ProductStatus;
  zone: ProductZone;
  onSale: boolean;
  published: boolean;
  posterMediaId: string | null;
  videoMediaId: string | null;
}

/** Updates the product row; when `zone` changes, also moves the linked
 * canvas_nodes row to the matching region and keeps its own `published`
 * mirroring the product's (fetchProductNodes() filters on both
 * independently — docs/decisions.md D-85). Both updates happen inside the
 * migration 0010 `update_product_with_node` RPC, in one server-side
 * transaction — the gap flagged in review (CodeRabbit, PR #38): a product
 * left with its new zone/published state while its node kept the old one
 * if the second write failed. Every UpdateProductInput key the optimistic
 * update below spreads in shares its name and type with the matching
 * AdminProductRow field, so `{ ...item, ...variables }` is a safe, direct
 * merge — not a coincidence, `queries.ts` and this file both camelCase the
 * same underlying columns. */
export function useUpdateProduct() {
  return useOptimisticMutation<AdminProductRow, UpdateProductInput, AdminProductRow[]>({
    queryKey: ADMIN_PRODUCTS_QUERY_KEY,
    mutationFn: async (input) => {
      const product = await updateProductWithUniqueSlug(input, input.slug);
      return mapRow(product);
    },
    updateCache: (previous, variables) =>
      (previous ?? []).map((item) => (item.id === variables.id ? { ...item, ...variables } : item)),
    errorMessage: () => "Couldn't save the change — please try again.",
  });
}

/** Deletes the canvas_nodes row and the product (which cascades
 * product_media — migration 0003's own `on delete cascade`) inside the
 * migration 0010 `delete_product_with_node` RPC, in one server-side
 * transaction — the gap flagged in review (CodeRabbit, PR #38): a product
 * left orphaned from the board if the product delete failed after the node
 * delete had already committed. The underlying media rows and their
 * uploaded Storage files are still left behind — a documented, accepted
 * gap (docs/decisions.md D-85), matching scripts/seed-products.ts's own
 * existing stance that Storage cleanup is a manual, owner-invoked concern,
 * not something built out here. */
export function useDeleteProduct() {
  return useOptimisticMutation<string, string, AdminProductRow[]>({
    queryKey: ADMIN_PRODUCTS_QUERY_KEY,
    mutationFn: async (id) => {
      const { error } = await supabase.rpc("delete_product_with_node", { p_id: id });
      if (error) throw error;
      return id;
    },
    updateCache: (previous, id) => (previous ?? []).filter((item) => item.id !== id),
    errorMessage: () => "Couldn't delete the product — please try again.",
  });
}

/** Where a product sitting at `index` in the given, already-sorted list
 * would land after a move, and the {id, sortOrder} pair to write for
 * every row — null at either end (nothing to swap with). Pure and
 * unit-tested on its own: the hook below only has to call supabase with
 * whatever this returns.
 *
 * Always renumbers the *whole* list 0..n-1 by its new array position
 * after the move, rather than just swapping the two moved rows' own
 * values. A first version of this function only swapped the two values
 * when they already differed, and only renumbered the whole list when
 * they were equal (found in review, CodeRabbit, PR #38, as a direct
 * follow-up to the sortOrder=0 bug fixed earlier in this same PR) — but
 * a plain two-value swap can still collide with a *third* row's existing
 * sortOrder even when the swapped pair's own values differ (e.g. ranks
 * `(b,0) (c,0) (a,1)`: moving "c" down swaps c→1/a→0, which gives a the
 * same rank 0 as b — a tie the swap itself just created, between a row
 * it never touched and one it did), so checking only the swapped pair
 * isn't enough. Always renumbering by array position is unconditionally
 * correct for any input, tied or not, and for a realistic admin
 * catalogue size the extra writes (one per product, not two) cost
 * nothing worth optimising away. */
export function reorderSwap(
  products: AdminProductRow[],
  id: string,
  direction: "up" | "down"
): { id: string; sortOrder: number }[] | null {
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= products.length) return null;

  const reordered = [...products];
  [reordered[index], reordered[neighbourIndex]] = [reordered[neighbourIndex], reordered[index]];
  return reordered.map((product, i) => ({ id: product.id, sortOrder: i }));
}

export interface ReorderVariables {
  products: AdminProductRow[];
  id: string;
  direction: "up" | "down";
}

function applySwap(previous: AdminProductRow[] | undefined, variables: ReorderVariables): AdminProductRow[] {
  const swap = reorderSwap(variables.products, variables.id, variables.direction);
  if (!swap) return previous ?? [];
  return (previous ?? [])
    .map((item) => {
      const match = swap.find((s) => s.id === item.id);
      return match ? { ...item, sortOrder: match.sortOrder } : item;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** updateCache (the optimistic path) and mutationFn (the real one) both
 * derive the same swap from `reorderSwap()`, called independently in each
 * — pure and deterministic given the same `variables`, so that's not
 * duplicated state, just the same one calculation run twice on the same
 * inputs, the same shape every other useOptimisticMutation caller uses. */
export function useReorderProduct() {
  return useOptimisticMutation<ReturnType<typeof reorderSwap>, ReorderVariables, AdminProductRow[]>({
    queryKey: ADMIN_PRODUCTS_QUERY_KEY,
    mutationFn: async (variables) => {
      const swap = reorderSwap(variables.products, variables.id, variables.direction);
      if (!swap) return null;

      // One call to the migration 0010 `reorder_products` RPC — reorderSwap()
      // now unconditionally renumbers the whole list by new array position
      // (see its own doc comment), so `swap` is always every row, not just
      // the two moved ones. A single `update ... from unnest(...)` statement
      // server-side means a partial write (some rows renumbered, others
      // not) is no longer possible. Fixes the gap flagged in review
      // (CodeRabbit, PR #38): sequential writes where a failure after the
      // first left rows with inconsistent sort_order.
      const { error } = await supabase.rpc("reorder_products", {
        p_ids: swap.map((s) => s.id),
        p_sort_orders: swap.map((s) => s.sortOrder),
      });
      if (error) throw error;

      return swap;
    },
    updateCache: applySwap,
    errorMessage: () => "Couldn't reorder the products — please try again.",
  });
}

export interface ProductPicture {
  /** product_media's own row id — not the media row's id, since that's
   * what useRemoveProductPicture deletes by. */
  id: string;
  mediaId: string;
  sortOrder: number;
}

export const PRODUCT_PICTURES_QUERY_KEY = (productId: string) => ["admin", "product-pictures", productId] as const;

/** The gallery (product_media rows of kind 'picture') for one product —
 * separate from the required poster (products.poster_media_id) and the
 * single turntable video (products.video_media_id), both plain columns on
 * the product row itself. Only fetched once a product exists (ProductForm
 * doesn't call this during the no-media create step). */
export function useProductPictures(productId: string | undefined) {
  return useQuery({
    queryKey: PRODUCT_PICTURES_QUERY_KEY(productId ?? ""),
    queryFn: async (): Promise<ProductPicture[]> => {
      const { data, error } = await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId as string)
        .eq("kind", "picture")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((row) => ({ id: row.id, mediaId: row.media_id, sortOrder: row.sort_order }));
    },
    enabled: !!productId,
  });
}

export interface AddProductPictureInput {
  productId: string;
  mediaId: string;
  sortOrder: number;
}

/** Adds one gallery picture. Not run through useOptimisticMutation: the
 * real product_media row id (needed to remove it again later) only exists
 * after the insert succeeds, so there's nothing meaningful to show
 * optimistically — invalidating the query once the real row lands is
 * simpler and just as immediate for a single-admin tool. */
export function useAddProductPicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddProductPictureInput) => {
      const { error } = await supabase
        .from("product_media")
        .insert({ product_id: input.productId, media_id: input.mediaId, kind: "picture", sort_order: input.sortOrder });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_PICTURES_QUERY_KEY(variables.productId) });
    },
    onError: () => {
      toast("Couldn't attach that picture — please try again.");
    },
  });
}

/** Removes one gallery picture's product_media row only — the underlying
 * media row/Storage file is left, same documented, accepted gap as
 * useDeleteProduct's own comment explains for a deleted product's media. */
export function useRemoveProductPicture() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; productId: string }) => {
      const { error } = await supabase.from("product_media").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: PRODUCT_PICTURES_QUERY_KEY(variables.productId) });
    },
    onError: () => {
      toast("Couldn't remove that picture — please try again.");
    },
  });
}
