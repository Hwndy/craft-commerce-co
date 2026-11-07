/**
 * Level of detail by on-screen width (docs/02-canvas-spec.md §5): under
 * 80px a node renders nothing (its zoomMin/zoomMax decide visibility
 * separately — this is purely the detail tier once a node is visible),
 * under 400px a thumbnail, otherwise full. Pure, no DOM/React.
 */
export type LevelOfDetail = "placeholder" | "thumbnail" | "full";

export const LOD_PLACEHOLDER_MAX_PX = 80;
export const LOD_THUMBNAIL_MAX_PX = 400;

export function levelOfDetailForWidth(onScreenWidthPx: number): LevelOfDetail {
  if (onScreenWidthPx < LOD_PLACEHOLDER_MAX_PX) return "placeholder";
  if (onScreenWidthPx < LOD_THUMBNAIL_MAX_PX) return "thumbnail";
  return "full";
}

/** on-screen width of a node's world-unit width, for the given zoom. */
export function onScreenWidth(nodeWorldWidth: number, zoom: number): number {
  return nodeWorldWidth * zoom;
}

export function levelOfDetailForNode(nodeWorldWidth: number, zoom: number): LevelOfDetail {
  return levelOfDetailForWidth(onScreenWidth(nodeWorldWidth, zoom));
}
