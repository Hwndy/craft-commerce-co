/**
 * Collage layout: deterministic photo positions in world units. Pure, no
 * DOM/React — docs/00-product-brief.md FR-3.1 ("circular / spherical
 * collage... diagonal strips kept as an alternate layout setting") and
 * docs/02-canvas-spec.md's phyllotaxis formula (`angle = i * 137.508°`,
 * `radius = c * sqrt(i)`, tilt seeded from the photo id within about ±8°,
 * small size variation).
 *
 * Determinism matters here specifically: the same photo ids, in the same
 * order, must always produce the same layout (no `Math.random`) — that's
 * what keeps focus/keyboard navigation and e2e assertions stable across
 * renders, and what "seeded from the photo id" means for tilt/size jitter.
 */
import type { Rect } from "@/canvas/types";

export const GOLDEN_ANGLE_DEG = 137.50776;
export const DEFAULT_RADIUS_STEP = 60;
export const DEFAULT_BASE_SIZE = 220;
export const DEFAULT_TILT_RANGE_DEG = 8;
export const DEFAULT_SIZE_JITTER = 0.12;

export const DEFAULT_ITEMS_PER_STRIP = 5;
export const DEFAULT_STRIP_TILT_DEG = -6;
export const DEFAULT_STRIP_TILT_JITTER_DEG = 3;
export const DEFAULT_COL_SPACING = 240;
export const DEFAULT_ROW_SPACING = 200;
export const DEFAULT_ROW_OFFSET_X = 60;

export type CollageLayoutMode = "circular" | "strips";

export interface CollageLayoutPhoto {
  id: string;
  /** width / height; defaults to 1 (square) if unknown. */
  aspectRatio: number;
}

export interface CollageNodeLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface CollageLayoutOptions {
  mode?: CollageLayoutMode;
  centerX?: number;
  centerY?: number;
  baseSize?: number;
  sizeJitter?: number;
  /** circular only */
  radiusStep?: number;
  tiltRangeDeg?: number;
  /** strips only */
  itemsPerStrip?: number;
  stripTiltDeg?: number;
  colSpacing?: number;
  rowSpacing?: number;
  rowOffsetX?: number;
}

/**
 * Deterministic pseudo-random value in [0, 1) from an id + salt, via
 * FNV-1a. No `Math.random` — the same id and salt always give the same
 * value, which is what "tilt seeded from the photo id" requires.
 */
function hashUnitInterval(id: string, salt: string): number {
  const input = `${id}:${salt}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function sizeFromAspect(aspectRatio: number, longEdge: number): { width: number; height: number } {
  const aspect = aspectRatio > 0 ? aspectRatio : 1;
  return aspect >= 1
    ? { width: longEdge, height: longEdge / aspect }
    : { width: longEdge * aspect, height: longEdge };
}

/** FR-3.1's primary layout: a golden-angle (phyllotaxis) spiral. */
export function phyllotaxisLayout(
  photos: CollageLayoutPhoto[],
  options: CollageLayoutOptions = {}
): CollageNodeLayout[] {
  const {
    centerX = 0,
    centerY = 0,
    radiusStep = DEFAULT_RADIUS_STEP,
    baseSize = DEFAULT_BASE_SIZE,
    tiltRangeDeg = DEFAULT_TILT_RANGE_DEG,
    sizeJitter = DEFAULT_SIZE_JITTER,
  } = options;

  return photos.map((photo, index) => {
    const n = index + 1;
    const angleRad = (index * GOLDEN_ANGLE_DEG * Math.PI) / 180;
    const radius = radiusStep * Math.sqrt(n);
    const cx = centerX + radius * Math.cos(angleRad);
    const cy = centerY + radius * Math.sin(angleRad);

    const sizeFactor = 1 + (hashUnitInterval(photo.id, "size") * 2 - 1) * sizeJitter;
    const { width, height } = sizeFromAspect(photo.aspectRatio, baseSize * sizeFactor);
    const rotation = (hashUnitInterval(photo.id, "tilt") * 2 - 1) * tiltRangeDeg;

    return { id: photo.id, x: cx - width / 2, y: cy - height / 2, width, height, rotation };
  });
}

/** FR-3.1's alternate layout setting ("Idea 1"): diagonally offset rows. */
export function stripsLayout(
  photos: CollageLayoutPhoto[],
  options: CollageLayoutOptions = {}
): CollageNodeLayout[] {
  const {
    centerX = 0,
    centerY = 0,
    baseSize = DEFAULT_BASE_SIZE,
    sizeJitter = DEFAULT_SIZE_JITTER,
    itemsPerStrip = DEFAULT_ITEMS_PER_STRIP,
    stripTiltDeg = DEFAULT_STRIP_TILT_DEG,
    colSpacing = DEFAULT_COL_SPACING,
    rowSpacing = DEFAULT_ROW_SPACING,
    rowOffsetX = DEFAULT_ROW_OFFSET_X,
  } = options;

  return photos.map((photo, index) => {
    const row = Math.floor(index / itemsPerStrip);
    const col = index % itemsPerStrip;

    const sizeFactor = 1 + (hashUnitInterval(photo.id, "size") * 2 - 1) * sizeJitter;
    const { width, height } = sizeFromAspect(photo.aspectRatio, baseSize * sizeFactor);

    const cx = centerX + col * colSpacing + row * rowOffsetX;
    const cy = centerY + row * rowSpacing;
    const tiltJitter = (hashUnitInterval(photo.id, "tilt") * 2 - 1) * DEFAULT_STRIP_TILT_JITTER_DEG;

    return {
      id: photo.id,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      rotation: stripTiltDeg + tiltJitter,
    };
  });
}

export function layoutCollage(
  photos: CollageLayoutPhoto[],
  options: CollageLayoutOptions = {}
): CollageNodeLayout[] {
  return options.mode === "strips" ? stripsLayout(photos, options) : phyllotaxisLayout(photos, options);
}

/** The world-space bounding box of a layout, for sizing the collage Region. */
export function collageBoundingBox(layouts: CollageNodeLayout[]): Rect {
  if (layouts.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layout of layouts) {
    minX = Math.min(minX, layout.x);
    minY = Math.min(minY, layout.y);
    maxX = Math.max(maxX, layout.x + layout.width);
    maxY = Math.max(maxY, layout.y + layout.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
