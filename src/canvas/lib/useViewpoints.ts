import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchViewpoints, VIEWPOINTS_QUERY_KEY } from "./queries";
import { setViewpointsCache } from "../viewpoints";

/**
 * Fetches the real `viewpoints` table and mirrors it into the module-level
 * cache `getViewpoint`/`listViewpoints` read synchronously from — those
 * stay the stable, synchronous call-site API; this hook just keeps their
 * data source fresh. Mount once near the app root (not per-route), same as
 * src/features/film/lib/useFilm() is used — content changes rarely.
 */
export function useViewpointsQuery() {
  const query = useQuery({
    queryKey: VIEWPOINTS_QUERY_KEY,
    queryFn: fetchViewpoints,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) setViewpointsCache(query.data);
  }, [query.data]);

  return query;
}
