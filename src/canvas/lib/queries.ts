import { supabase } from "@/lib/supabase";

import type { Viewpoint } from "../types";

export const VIEWPOINTS_QUERY_KEY = ["viewpoints"] as const;

/** All viewpoints (no published flag of its own — see migration 0002). */
export async function fetchViewpoints(): Promise<Viewpoint[]> {
  const { data, error } = await supabase.from("viewpoints").select("*").order("sort_order");
  if (error) throw error;

  return data.map((row) => ({
    key: row.key,
    label: row.label,
    x: row.x,
    y: row.y,
    zoom: row.zoom,
    sortOrder: row.sort_order,
    inGuidedPath: row.in_guided_path,
  }));
}
