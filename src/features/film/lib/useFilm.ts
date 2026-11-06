import { useQuery } from "@tanstack/react-query";

import { FILM_QUERY_KEY, fetchPublishedFilm } from "./queries";

/** The published film, read via the anon key under RLS. No service key. */
export function useFilm() {
  return useQuery({
    queryKey: FILM_QUERY_KEY,
    queryFn: fetchPublishedFilm,
    // Content changes rarely (docs/01-architecture.md §4).
    staleTime: 5 * 60_000,
  });
}
