import { cameraCenter } from "./math";
import type { Camera, Viewpoint } from "./types";
import { viewpointCenter } from "./viewpoints";

/** The viewpoint whose centre is closest to the camera's current centre, or null if the list is empty. */
export function nearestViewpoint(camera: Camera, viewpoints: Viewpoint[], vw: number, vh: number): Viewpoint | null {
  if (viewpoints.length === 0) return null;
  const center = cameraCenter(camera, vw, vh);
  let best: Viewpoint = viewpoints[0];
  let bestDistance = Infinity;
  for (const viewpoint of viewpoints) {
    // viewpointCenter, not a raw cameraCenter(viewpoint, ...): see its own
    // doc comment — About/Contact's real landed camera (cameraForViewpoint)
    // no longer matches their raw x/y treated as a camera position (found
    // in review, Greptile, PR #3).
    const vpCenter = viewpointCenter(viewpoint, vw, vh);
    const distance = Math.hypot(vpCenter.x - center.x, vpCenter.y - center.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = viewpoint;
    }
  }
  return best;
}
