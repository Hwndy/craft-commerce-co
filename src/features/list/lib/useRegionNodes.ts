import { useQuery } from "@tanstack/react-query";

import { fetchRegionNodes, REGION_NODES_QUERY_KEY } from "./queries";

export function useRegionNodes(region: string) {
  return useQuery({
    queryKey: REGION_NODES_QUERY_KEY(region),
    queryFn: () => fetchRegionNodes(region),
    staleTime: 60_000,
  });
}
