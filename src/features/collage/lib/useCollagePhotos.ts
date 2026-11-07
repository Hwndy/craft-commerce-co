import { useQuery } from "@tanstack/react-query";

import { COLLAGE_PHOTOS_QUERY_KEY, fetchCollagePhotos } from "./queries";

export function useCollagePhotos() {
  return useQuery({ queryKey: COLLAGE_PHOTOS_QUERY_KEY, queryFn: fetchCollagePhotos });
}
