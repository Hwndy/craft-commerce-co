import type { Viewpoint } from "./types";

/**
 * Static registry for Phase 1. Phase 2 replaces this with the `viewpoints`
 * table (migration 0002); callers should keep using `getViewpoint` /
 * `listViewpoints` so that swap doesn't touch call sites.
 */
const viewpoints: Record<string, Viewpoint> = {
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
};

export function getViewpoint(key: string): Viewpoint {
  const viewpoint = viewpoints[key];
  if (!viewpoint) {
    throw new Error(`Unknown viewpoint: ${key}`);
  }
  return viewpoint;
}

export function listViewpoints(): Viewpoint[] {
  return Object.values(viewpoints).sort((a, b) => a.sortOrder - b.sortOrder);
}
