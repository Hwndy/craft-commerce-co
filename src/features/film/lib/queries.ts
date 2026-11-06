import { supabase } from "@/lib/supabase";

export const FILM_QUERY_KEY = ["film"] as const;

/** Matches scripts/encode-hls.sh's sprite.json (docs/02-canvas-spec.md). */
export interface SpriteMeta {
  cols: number;
  rows: number;
  w: number;
  h: number;
  interval: number;
}

export interface PublishedFilm {
  id: string;
  title: string;
  version: number;
  captionsPath: string | null;
  media: {
    id: string;
    hlsMaster: string | null;
    posterPath: string | null;
    spritePath: string | null;
    spriteMeta: SpriteMeta | null;
    durationS: number | null;
  };
}

/**
 * The published film (and its ready media), or null if neither exists yet.
 * Reused as-is by the film player (T7); T6 only needs it to warm the cache
 * during the entry sequence.
 */
export async function fetchPublishedFilm(): Promise<PublishedFilm | null> {
  const { data: film, error: filmError } = await supabase
    .from("gallery_film")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (filmError) throw filmError;
  if (!film) return null;

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("*")
    .eq("id", film.media_id)
    .eq("status", "ready")
    .maybeSingle();
  if (mediaError) throw mediaError;
  if (!media) return null;

  return {
    id: film.id,
    title: film.title,
    version: film.version,
    captionsPath: film.captions_path,
    media: {
      id: media.id,
      hlsMaster: media.hls_master,
      posterPath: media.poster_path,
      spritePath: media.sprite_path,
      spriteMeta: media.sprite_meta as unknown as SpriteMeta | null,
      durationS: media.duration_s,
    },
  };
}
