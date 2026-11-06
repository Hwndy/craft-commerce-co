import type { QueryClient } from "@tanstack/react-query";

import { siteMediaUrl } from "@/lib/storage";
import { FILM_QUERY_KEY, fetchPublishedFilm } from "@/features/film/lib/queries";

/**
 * Fired once at the start of the entry sequence so the film is ready by the
 * reveal: prefetches the ['film'] query, then warms the poster image and
 * the master playlist in the HTTP cache. Best-effort — a failure here
 * should never block the entry sequence, since T7/T8's own fallback chain
 * handles a film that isn't ready yet.
 */
export async function preloadFilmAssets(queryClient: QueryClient): Promise<void> {
  try {
    const film = await queryClient.fetchQuery({
      queryKey: FILM_QUERY_KEY,
      queryFn: fetchPublishedFilm,
      staleTime: 60_000,
    });
    if (!film) return;

    if (film.media.posterPath) {
      const image = new Image();
      image.src = siteMediaUrl(film.media.posterPath);
    }
    if (film.media.hlsMaster) {
      void fetch(siteMediaUrl(film.media.hlsMaster)).catch(() => {});
    }
  } catch {
    // Best-effort preload; T7/T8 handle a film that fails to load.
  }
}
