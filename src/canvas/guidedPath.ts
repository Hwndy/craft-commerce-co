/**
 * Pure helpers over the ordered guided path (docs/02-canvas-spec.md §6):
 * "Ordered list of viewpoints marked in_guided_path." No DOM/React.
 */
import { cameraCenter } from "./math";
import type { Camera, Viewpoint } from "./types";

/** Viewpoints in the guided path, in order. */
export function guidedPathViewpoints(viewpoints: Viewpoint[]): Viewpoint[] {
  return viewpoints
    .filter((v) => v.inGuidedPath)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Clamped (not wrapping) index — Next/Previous stop at the ends of the path. */
export function clampGuidedIndex(index: number, pathLength: number): number {
  if (pathLength <= 0) return 0;
  return Math.min(pathLength - 1, Math.max(0, index));
}

/**
 * Index of the guided-path viewpoint whose centre is closest to the
 * camera's current centre — used when switching Explore -> Guided mode
 * (spec: "switching back flies to the nearest path viewpoint").
 */
export function nearestGuidedIndex(camera: Camera, path: Viewpoint[], vw: number, vh: number): number {
  if (path.length === 0) return 0;
  const center = cameraCenter(camera, vw, vh);
  let bestIndex = 0;
  let bestDistance = Infinity;
  path.forEach((viewpoint, index) => {
    const vpCenter = cameraCenter(viewpoint, vw, vh);
    const distance = Math.hypot(vpCenter.x - center.x, vpCenter.y - center.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}
