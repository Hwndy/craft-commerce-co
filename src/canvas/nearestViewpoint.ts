import { cameraCenter } from "./math";
import type { Camera, Viewpoint } from "./types";

/** The viewpoint whose centre is closest to the camera's current centre, or null if the list is empty. */
export function nearestViewpoint(camera: Camera, viewpoints: Viewpoint[], vw: number, vh: number): Viewpoint | null {
  if (viewpoints.length === 0) return null;
  const center = cameraCenter(camera, vw, vh);
  let best: Viewpoint = viewpoints[0];
  let bestDistance = Infinity;
  for (const viewpoint of viewpoints) {
    const vpCenter = cameraCenter(viewpoint, vw, vh);
    const distance = Math.hypot(vpCenter.x - center.x, vpCenter.y - center.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = viewpoint;
    }
  }
  return best;
}
