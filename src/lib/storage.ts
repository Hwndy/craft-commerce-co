import { env } from "@/lib/env";

/** Public URL for a path inside the public site-media bucket. */
export function siteMediaUrl(path: string): string {
  return `${env.VITE_SUPABASE_URL}/storage/v1/object/public/site-media/${path}`;
}
