import type { CollagePhoto } from "./queries";

export interface Shoot {
  id: string;
  title: string;
}

/**
 * The distinct shoots present in `photos`, in first-seen order — which is
 * already photo_set order, since fetchCollagePhotos() sorts by set before
 * flattening (FR-3.8). Drives the Collage's shoot-filter chip row
 * (docs/decisions.md D-45): pure so it's trivially unit-testable without a
 * live query.
 */
export function distinctShoots(photos: CollagePhoto[]): Shoot[] {
  const seen = new Map<string, Shoot>();
  for (const photo of photos) {
    if (!seen.has(photo.shoot.id)) seen.set(photo.shoot.id, photo.shoot);
  }
  return [...seen.values()];
}
