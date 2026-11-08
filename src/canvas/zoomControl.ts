import { screenToWorld } from "./math";
import { useCameraStore } from "./store";

export const ZOOM_STEP_FACTOR = 1.3;

/**
 * Zooms the camera by `factor` about the current viewport's centre, clamped
 * to zoomLimits — one definition of "zoom in/out one step" shared by
 * useBoardKeyboard.ts's +/- keys and any on-screen zoom button (e.g. the
 * Collage screen's zoom cluster, docs/decisions.md D-45).
 */
export function zoomAtViewportCenter(factor: number) {
  const { camera, setCamera, viewport, zoomLimits } = useCameraStore.getState();
  const sx = viewport.width / 2;
  const sy = viewport.height / 2;
  const before = screenToWorld(camera, sx, sy);
  const targetZoom = Math.min(zoomLimits.max, Math.max(zoomLimits.min, camera.zoom * factor));
  setCamera({
    x: before.x - sx / targetZoom,
    y: before.y - sy / targetZoom,
    zoom: targetZoom,
  });
}
