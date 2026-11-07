import { supabase } from "@/lib/supabase";

export const REGION_NODES_QUERY_KEY = (region: string) => ["list", "region-nodes", region] as const;

export interface RegionNode {
  id: string;
  nodeType: string;
  refTable: string | null;
  refId: string | null;
}

/** Published canvas_nodes for one region, in a stable reading order (layer, then id). */
export async function fetchRegionNodes(region: string): Promise<RegionNode[]> {
  const { data, error } = await supabase
    .from("canvas_nodes")
    .select("*")
    .eq("region", region)
    .eq("published", true)
    .order("layer")
    .order("id");
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    nodeType: row.node_type,
    refTable: row.ref_table,
    refId: row.ref_id,
  }));
}
