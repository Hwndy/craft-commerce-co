import { supabase } from "@/lib/supabase";

export const COLLAGE_PHOTOS_QUERY_KEY = ["collage", "photos"] as const;

export interface CollagePhoto {
  id: string;
  title: string;
  takenOn: string | null;
  /** The photo_set ("shoot") this photo belongs to (FR-3.8) — drives the
   * Collage's shoot-filter chips (docs/decisions.md D-45). */
  shoot: { id: string; title: string };
  media: {
    id: string;
    width: number | null;
    height: number | null;
    blurDataUrl: string | null;
    renditions: Record<string, string>;
  };
}

/**
 * Every photo in a published photo_set, across all published sets, in set
 * order then the set's own sort_order (docs/00-product-brief.md FR-3.8:
 * "photo sets grouped by shoot; order controlled in admin"). RLS already
 * restricts `photos` reads to rows whose parent set is published; the
 * explicit `photo_sets` query here is only to get each set's own ordering
 * and to group by it client-side (a single cross-set `order()` on `photos`
 * would interleave sets, since scripts/seed-photos.ts's sort_order starts
 * at 0 within each set).
 */
export async function fetchCollagePhotos(): Promise<CollagePhoto[]> {
  const { data: sets, error: setsError } = await supabase
    .from("photo_sets")
    .select("*")
    .eq("published", true)
    .order("sort_order")
    .order("id");
  if (setsError) throw setsError;
  if (!sets || sets.length === 0) return [];

  const setIds = sets.map((s) => s.id);
  const { data: photos, error: photosError } = await supabase.from("photos").select("*").in("set_id", setIds);
  if (photosError) throw photosError;
  if (!photos || photos.length === 0) return [];

  const mediaIds = Array.from(new Set(photos.map((p) => p.media_id)));
  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("*")
    .in("id", mediaIds)
    .eq("status", "ready");
  if (mediaError) throw mediaError;

  const mediaById = new Map((media ?? []).map((m) => [m.id, m]));
  const setOrderById = new Map(sets.map((s, index) => [s.id, index]));
  const setById = new Map(sets.map((s) => [s.id, s]));

  return photos
    .filter((photo) => mediaById.has(photo.media_id))
    .sort((a, b) => {
      const setDiff = (setOrderById.get(a.set_id) ?? 0) - (setOrderById.get(b.set_id) ?? 0);
      if (setDiff !== 0) return setDiff;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.id.localeCompare(b.id);
    })
    .map((photo) => {
      const media = mediaById.get(photo.media_id)!;
      const set = setById.get(photo.set_id)!;
      return {
        id: photo.id,
        title: photo.title,
        takenOn: photo.taken_on,
        shoot: { id: set.id, title: set.title },
        media: {
          id: media.id,
          width: media.width,
          height: media.height,
          blurDataUrl: media.blur_data_url,
          renditions: (media.renditions ?? {}) as Record<string, string>,
        },
      };
    });
}
