/**
 * Pure helpers for the photo viewer's cycling (docs/00-product-brief.md
 * FR-3.4: "cycle forward and back by swipe, click or arrows; the last
 * image loops to the first") and rendition choice (FR-3.3: "1280 or 2048
 * px by screen size"). No DOM/React, so the loop-at-the-ends behaviour and
 * the width threshold are both directly unit-testable.
 */
export const VIEWER_WIDE_SCREEN_PX = 1600;
export type ViewerRendition = "1280" | "2048";

export function renditionForScreenWidth(screenWidthPx: number): ViewerRendition {
  return screenWidthPx >= VIEWER_WIDE_SCREEN_PX ? "2048" : "1280";
}

/** The id `delta` steps away from `currentId` in `ids`, wrapping at both ends. */
export function cyclePhotoId(ids: string[], currentId: string, delta: number): string | null {
  if (ids.length === 0) return null;
  const index = ids.indexOf(currentId);
  if (index === -1) return null;
  const nextIndex = (((index + delta) % ids.length) + ids.length) % ids.length;
  return ids[nextIndex];
}
