import { useCameraStore } from "./store";

const DEFAULT_MARGIN = 16;

/**
 * Shrinks a fixed-size panel's width/height just enough to fit the
 * current viewport, at the region's own zoom (1, for About/Contact —
 * world units equal CSS pixels at that zoom). A Region's own world-space
 * size is otherwise completely fixed regardless of viewport — fine for
 * Gallery/Shop/Collage, whose content is either hidden behind the film
 * layer or reached by panning around a larger generative layout, but
 * About/Contact (T6) are read immediately, in full, the moment a visitor
 * arrives — on a narrow mobile viewport (Pixel 7: 412px wide) a fixed
 * 760px-wide panel only had its *middle* slice on screen once centred,
 * permanently leaving left-aligned content like the submit button
 * outside the viewport entirely. Found via real CI (not this sandbox's
 * own local check, which only ever used a desktop-sized browser window):
 * `locator.click: ... element is outside of the viewport`, mobile-chrome
 * only, on About/Contact's own e2e suite (PR #3).
 *
 * Reactive (not computed once): a real device can rotate, and the
 * viewport is 0×0 for the one tick before Board's own ResizeObserver
 * first measures it, so this falls back to the panel's own maximum size
 * until a real, non-zero viewport is known.
 */
export function useFittedPanelSize(
  maxWidth: number,
  maxHeight: number,
  margin: number = DEFAULT_MARGIN
): { width: number; height: number } {
  const viewportWidth = useCameraStore((s) => s.viewport.width);
  const viewportHeight = useCameraStore((s) => s.viewport.height);
  return {
    width: viewportWidth > 0 ? Math.min(maxWidth, viewportWidth - margin * 2) : maxWidth,
    height: viewportHeight > 0 ? Math.min(maxHeight, viewportHeight - margin * 2) : maxHeight,
  };
}
