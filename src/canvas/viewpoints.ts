import type { Viewpoint } from "./types";

/**
 * Static fallback registry — used until `useViewpointsQuery()` (lib/
 * useViewpoints.ts) loads the real `viewpoints` table (migration 0002)
 * and calls `setViewpointsCache`, and again if that query ever fails
 * (offline, etc.). Keeps `landing`/`gallery` at the exact positions Phase
 * 1's entry sequence and gate flow were verified against, so this can
 * never silently move the camera somewhere those tests don't expect.
 * `collage` is included too (matching supabase/seed.sql exactly) because
 * Gallery.tsx's Collage region (T8) reads its centre synchronously at
 * mount — before the real query can possibly have resolved yet.
 *
 * `getViewpoint`/`listViewpoints` stay synchronous so every existing call
 * site (event handlers, non-component code like useBoardKeyboard.ts) keeps
 * working unchanged — only the data source behind them changes.
 */
const fallbackViewpoints: Record<string, Viewpoint> = {
  landing: {
    key: "landing",
    label: "Landing",
    x: 0,
    y: 0,
    zoom: 1,
    sortOrder: 0,
    inGuidedPath: true,
  },
  gallery: {
    key: "gallery",
    label: "Gallery",
    x: 2000,
    y: 0,
    zoom: 1,
    sortOrder: 1,
    inGuidedPath: true,
  },
  collage: {
    key: "collage",
    label: "Collage",
    x: 2000,
    y: 1200,
    zoom: 1,
    sortOrder: 2,
    inGuidedPath: true,
  },
};

let cachedViewpoints: Record<string, Viewpoint> | null = null;

/** Called by useViewpointsQuery() once the real table has loaded. */
export function setViewpointsCache(viewpoints: Viewpoint[]): void {
  cachedViewpoints = Object.fromEntries(viewpoints.map((v) => [v.key, v]));
}

/** Test-only: clears the cache so a test can exercise the fallback path. */
export function clearViewpointsCache(): void {
  cachedViewpoints = null;
}

function activeViewpoints(): Record<string, Viewpoint> {
  return cachedViewpoints ?? fallbackViewpoints;
}

export function getViewpoint(key: string): Viewpoint {
  const viewpoint = activeViewpoints()[key];
  if (!viewpoint) {
    throw new Error(`Unknown viewpoint: ${key}`);
  }
  return viewpoint;
}

export function listViewpoints(): Viewpoint[] {
  return Object.values(activeViewpoints()).sort((a, b) => a.sortOrder - b.sortOrder);
}
