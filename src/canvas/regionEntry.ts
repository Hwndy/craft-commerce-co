/**
 * Semantic zoom's region entry threshold (docs/02-canvas-spec.md §5): "A
 * region enters when its on-screen area covers 70% of the viewport and the
 * camera has been stable for 250ms." Pure, no DOM/React.
 */
import { intersectionArea, visibleWorldRect } from "./math";
import type { Camera, Rect } from "./types";

export const DEFAULT_COVERAGE_THRESHOLD = 0.7;
export const DEFAULT_STABLE_MS = 250;

/**
 * Fraction (0..1) of the viewport's on-screen area that `regionRect`
 * covers, for the given camera. 1 means the region fills the whole
 * viewport; 0 means no overlap at all.
 */
export function regionCoverageFraction(regionRect: Rect, camera: Camera, vw: number, vh: number): number {
  const visible = visibleWorldRect(camera, vw, vh);
  const visibleArea = visible.width * visible.height;
  if (visibleArea <= 0) return 0;
  return intersectionArea(regionRect, visible) / visibleArea;
}

export function hasEnteredRegion(
  regionRect: Rect,
  camera: Camera,
  vw: number,
  vh: number,
  threshold = DEFAULT_COVERAGE_THRESHOLD
): boolean {
  return regionCoverageFraction(regionRect, camera, vw, vh) >= threshold;
}
