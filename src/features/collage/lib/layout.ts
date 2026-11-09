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
// Tuned so neighbouring photos (even at max size jitter, ~1.12 * baseSize)
// don't overlap — the minimum pairwise distance between any two phyllotaxis
// points turns out to be set by the first couple of indices and doesn't
// shrink as more photos are added, so one constant works for any count.
// radiusStep=200 keeps a comfortable ~30% gap over the worst-case diameter
// at baseSize=220 (found by sampling candidate steps; see T8/T9's commit).
export const DEFAULT_RADIUS_STEP = 200;
export const DEFAULT_BASE_SIZE = 220;
export const DEFAULT_TILT_RANGE_DEG = 8;
export const DEFAULT_SIZE_JITTER = 0.12;

// "strips" mode groups photos into cascading, overlapping stacks — the
// owner's own Freeform sketch ("IDEA 1 for PICTURE LAYOUT"): roughly six
// stacks of ~20 photos each, fanned out diagonally so each stack reads as
// one dense pile, not an evenly-spaced grid (found from the owner's own
// walkthrough recording, not guessed — see docs/decisions.md D-62).
export const DEFAULT_ITEMS_PER_STACK = 20;
export const DEFAULT_STACK_TILT_DEG = -6;
export const DEFAULT_STACK_TILT_JITTER_DEG = 3;
// Small per-card offset within a stack — deliberately *less* than baseSize
// so consecutive cards overlap (a fanned-deck look), unlike
// DEFAULT_RADIUS_STEP above, which is tuned for the opposite (no overlap).
export const DEFAULT_STACK_OFFSET_X = 16;
export const DEFAULT_STACK_OFFSET_Y = 12;
// Stacks themselves are arranged in a simple grid, spaced far enough apart
// that one stack's fanned footprint (baseSize + (itemsPerStack-1)*offset)
// never reaches its neighbour's.
export const DEFAULT_STACKS_PER_ROW = 3;
export const DEFAULT_STACK_COL_SPACING = 650;
export const DEFAULT_STACK_ROW_SPACING = 560;

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
  itemsPerStack?: number;
  stackTiltDeg?: number;
  stackOffsetX?: number;
  stackOffsetY?: number;
  stacksPerRow?: number;
  stackColSpacing?: number;
  stackRowSpacing?: number;
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

/**
 * FR-3.1's alternate layout setting ("Idea 1"): photos grouped into
 * cascading, overlapping stacks — each stack a diagonal fan of up to
 * `itemsPerStack` cards, stacks themselves arranged in a grid. Later cards
 * in a stack get a later array index, so they paint over earlier ones in
 * `NodeLayer`'s own DOM-order stacking (no explicit z-index needed) — the
 * fanned-deck look depends on that painting order.
 */
export function stripsLayout(
  photos: CollageLayoutPhoto[],
  options: CollageLayoutOptions = {}
): CollageNodeLayout[] {
  const {
    centerX = 0,
    centerY = 0,
    baseSize = DEFAULT_BASE_SIZE,
    sizeJitter = DEFAULT_SIZE_JITTER,
    itemsPerStack = DEFAULT_ITEMS_PER_STACK,
    stackTiltDeg = DEFAULT_STACK_TILT_DEG,
    stackOffsetX = DEFAULT_STACK_OFFSET_X,
    stackOffsetY = DEFAULT_STACK_OFFSET_Y,
    stacksPerRow = DEFAULT_STACKS_PER_ROW,
    stackColSpacing = DEFAULT_STACK_COL_SPACING,
    stackRowSpacing = DEFAULT_STACK_ROW_SPACING,
  } = options;

  return photos.map((photo, index) => {
    const stackIndex = Math.floor(index / itemsPerStack);
    const withinStack = index % itemsPerStack;
    const stackCol = stackIndex % stacksPerRow;
    const stackRow = Math.floor(stackIndex / stacksPerRow);

    const sizeFactor = 1 + (hashUnitInterval(photo.id, "size") * 2 - 1) * sizeJitter;
    const { width, height } = sizeFromAspect(photo.aspectRatio, baseSize * sizeFactor);

    const stackOriginX = centerX + stackCol * stackColSpacing;
    const stackOriginY = centerY + stackRow * stackRowSpacing;
    const cx = stackOriginX + withinStack * stackOffsetX;
    const cy = stackOriginY + withinStack * stackOffsetY;
    const tiltJitter = (hashUnitInterval(photo.id, "tilt") * 2 - 1) * DEFAULT_STACK_TILT_JITTER_DEG;

    return {
      id: photo.id,
      x: cx - width / 2,
      y: cy - height / 2,
      width,
      height,
      rotation: stackTiltDeg + tiltJitter,
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
