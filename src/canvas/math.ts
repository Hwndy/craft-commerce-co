/**
 * Pure camera maths for the spatial canvas. No DOM, no React — see
 * docs/02-canvas-spec.md §2 for the formulas this implements.
 */
import type { Camera, Rect, ZoomLimits } from "./types";

export const DEFAULT_ZOOM_LIMITS: ZoomLimits = { min: 0.15, max: 6 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(t: number): number {
  return clamp(t, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clampZoom(
  zoom: number,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS
): number {
  return clamp(zoom, limits.min, limits.max);
}

export function easeInOutCubic(t: number): number {
  const c = clamp01(t);
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/** Screen point -> world point, for the given camera. */
export function screenToWorld(
  cam: Camera,
  sx: number,
  sy: number
): { x: number; y: number } {
  return { x: cam.x + sx / cam.zoom, y: cam.y + sy / cam.zoom };
}

/** World point -> screen point, for the given camera. */
export function worldToScreen(
  cam: Camera,
  wx: number,
  wy: number
): { x: number; y: number } {
  return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
}

/**
 * Zoom about a screen point (sx, sy) to z2, keeping the world point under
 * that screen point fixed on screen.
 */
export function zoomAboutPoint(
  cam: Camera,
  sx: number,
  sy: number,
  z2: number,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS
): Camera {
  const clampedZoom = clampZoom(z2, limits);
  const before = screenToWorld(cam, sx, sy);
  return {
    x: before.x - sx / clampedZoom,
    y: before.y - sy / clampedZoom,
    zoom: clampedZoom,
  };
}

/** Fit a world rectangle into a viewport, with padding (1 = exact fit). */
export function fitRectToViewport(
  rect: Rect,
  vw: number,
  vh: number,
  padding = 0.9,
  limits: ZoomLimits = DEFAULT_ZOOM_LIMITS
): Camera {
  const zoom = clampZoom(
    Math.min(vw / rect.width, vh / rect.height) * padding,
    limits
  );
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return { x: cx - vw / (2 * zoom), y: cy - vh / (2 * zoom), zoom };
}

/** The world rectangle currently visible in the viewport. */
export function visibleWorldRect(cam: Camera, vw: number, vh: number): Rect {
  return { x: cam.x, y: cam.y, width: vw / cam.zoom, height: vh / cam.zoom };
}

/** Area of the overlap between two rects, in the same units as each (0 if they don't overlap). */
export function intersectionArea(a: Rect, b: Rect): number {
  const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapWidth * overlapHeight;
}

/** The world point at the centre of the viewport for this camera. */
export function cameraCenter(
  cam: Camera,
  vw: number,
  vh: number
): { x: number; y: number } {
  return { x: cam.x + vw / (2 * cam.zoom), y: cam.y + vh / (2 * cam.zoom) };
}

/** The camera whose viewport centre sits on the given world point. */
export function cameraFromCenter(
  center: { x: number; y: number },
  zoom: number,
  vw: number,
  vh: number
): Camera {
  return { x: center.x - vw / (2 * zoom), y: center.y - vh / (2 * zoom), zoom };
}

/**
 * Flight interpolation between two cameras for t in 0..1. zoom is
 * interpolated in log space (so it feels like a continuous dolly rather
 * than a linear scale change); the viewport centre in world space is
 * interpolated with an ease-in-out curve. Converts back to camera x, y
 * via the interpolated viewport size, so this keeps the motion feeling
 * like a camera move rather than a cross-fade between two static frames.
 */
export function interpolateCamera(
  a: Camera,
  b: Camera,
  t: number,
  vw: number,
  vh: number
): Camera {
  const eased = easeInOutCubic(t);
  const zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), eased));
  const centerA = cameraCenter(a, vw, vh);
  const centerB = cameraCenter(b, vw, vh);
  const center = {
    x: lerp(centerA.x, centerB.x, eased),
    y: lerp(centerA.y, centerB.y, eased),
  };
  return cameraFromCenter(center, zoom, vw, vh);
}

/**
 * Flight duration in ms, scaled by how far the camera travels (in world
 * units, normalised against the viewport diagonal so it doesn't depend on
 * the absolute scale of world units). Clamped to docs/02-canvas-spec.md's
 * 900–2200 ms range.
 */
export function flightDurationMs(
  a: Camera,
  b: Camera,
  vw: number,
  vh: number,
  range: { min: number; max: number } = { min: 900, max: 2200 }
): number {
  const centerA = cameraCenter(a, vw, vh);
  const centerB = cameraCenter(b, vw, vh);
  const distance = Math.hypot(centerB.x - centerA.x, centerB.y - centerA.y);
  const viewportDiagonal = Math.hypot(vw, vh) || 1;
  // A flight of ~4 viewport-diagonals or more reaches the maximum duration.
  const reference = viewportDiagonal * 4;
  const t = clamp01(distance / reference);
  return range.min + t * (range.max - range.min);
}

/**
 * Exponential decay of a scalar (e.g. a drag-release velocity component)
 * over `dtSeconds`, at `halfLifeSeconds` (time for the value to halve).
 * Pure so the inertia loop's per-frame math is unit-testable without a
 * real rAF/pointer simulation. docs/02-canvas-spec.md §4: "inertia from
 * the drag velocity with exponential decay."
 */
export function exponentialDecay(
  value: number,
  dtSeconds: number,
  halfLifeSeconds = 0.25
): number {
  if (halfLifeSeconds <= 0) return 0;
  return value * Math.pow(0.5, dtSeconds / halfLifeSeconds);
}

/**
 * Keeps at least `minVisibleFraction` of `bounds` on screen for the given
 * camera (docs/02-canvas-spec.md §2: "Pan limits: keep at least one region
 * on screen"). Only nudges `x`/`y`; leaves `zoom` untouched. No-op if the
 * visible rect already overlaps `bounds` by at least that fraction in both
 * axes.
 */
export function clampPanToBounds(
  cam: Camera,
  bounds: Rect,
  vw: number,
  vh: number,
  minVisibleFraction = 0.1
): Camera {
  const visible = visibleWorldRect(cam, vw, vh);
  const minOverlapW = Math.min(visible.width, bounds.width) * minVisibleFraction;
  const minOverlapH = Math.min(visible.height, bounds.height) * minVisibleFraction;

  // visible.x must stay within [bounds.x - visible.width + minOverlapW, bounds.x + bounds.width - minOverlapW]
  const minX = bounds.x - visible.width + minOverlapW;
  const maxX = bounds.x + bounds.width - minOverlapW;
  const minY = bounds.y - visible.height + minOverlapH;
  const maxY = bounds.y + bounds.height - minOverlapH;

  return {
    ...cam,
    x: maxX >= minX ? clamp(cam.x, minX, maxX) : cam.x,
    y: maxY >= minY ? clamp(cam.y, minY, maxY) : cam.y,
  };
}
