/**
 * Culling: which nodes are worth mounting for a given camera. Pure, no
 * DOM/React — docs/02-canvas-spec.md §10 ("Culling index: a uniform grid,
 * cell size about 1000 world units") and §2 ("mounts nodes whose
 * rectangles intersect the visible rectangle expanded by a margin, e.g.
 * 25% each side").
 */
import type { Camera, CanvasNode, Rect } from "./types";
import { visibleWorldRect } from "./math";

export const DEFAULT_GRID_CELL_SIZE = 1000;
export const DEFAULT_CULL_MARGIN_FRACTION = 0.25;

/** Expands a rect by `marginFraction` of its own width/height, each side. */
export function expandRect(rect: Rect, marginFraction: number): Rect {
  const marginX = rect.width * marginFraction;
  const marginY = rect.height * marginFraction;
  return {
    x: rect.x - marginX,
    y: rect.y - marginY,
    width: rect.width + marginX * 2,
    height: rect.height + marginY * 2,
  };
}

/** True if two rects intersect (touching edges count as not intersecting). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export interface GridCell {
  col: number;
  row: number;
}

/** Which grid cells a rect overlaps, for a uniform grid of `cellSize`. */
export function cellsForRect(rect: Rect, cellSize = DEFAULT_GRID_CELL_SIZE): GridCell[] {
  if (rect.width <= 0 || rect.height <= 0 || cellSize <= 0) return [];
  const minCol = Math.floor(rect.x / cellSize);
  const maxCol = Math.floor((rect.x + rect.width) / cellSize);
  const minRow = Math.floor(rect.y / cellSize);
  const maxRow = Math.floor((rect.y + rect.height) / cellSize);
  const cells: GridCell[] = [];
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      cells.push({ col, row });
    }
  }
  return cells;
}

/** The world rect that should be considered "near the viewport" for culling. */
export function cullingRect(
  camera: Camera,
  vw: number,
  vh: number,
  marginFraction = DEFAULT_CULL_MARGIN_FRACTION
): Rect {
  return expandRect(visibleWorldRect(camera, vw, vh), marginFraction);
}

/** Nodes whose rect intersects the (margin-expanded) visible rect. */
export function cullNodes<T extends CanvasNode>(
  nodes: T[],
  camera: Camera,
  vw: number,
  vh: number,
  marginFraction = DEFAULT_CULL_MARGIN_FRACTION
): T[] {
  const visible = cullingRect(camera, vw, vh, marginFraction);
  return nodes.filter((node) =>
    rectsIntersect(visible, { x: node.x, y: node.y, width: node.width, height: node.height })
  );
}
