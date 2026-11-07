import { useEffect } from "react";

import { screenToWorld } from "./math";
import { useCameraStore } from "./store";
import { getViewpoint } from "./viewpoints";

const PAN_STEP_SCREEN_PX = 80;
const ZOOM_STEP_FACTOR = 1.3;

/**
 * Keyboard control for the board (docs/02-canvas-spec.md §4): arrows pan,
 * +/- zoom, 0 returns home, Esc zooms out one level. Also brings a
 * keyboard-focused node into view (Tab moves focus; the focusin listener
 * here re-centres the camera on whatever gained focus) — reading the
 * focused element's on-screen rect and converting through screenToWorld
 * works regardless of how deeply it's nested under Board's world element,
 * unlike chasing offsetParent chains.
 *
 * Entering a region or opening a node on Enter is region/node-type-
 * specific and lands with T4 (semantic zoom / region entry); for now
 * Enter just does the browser's native thing for a focused interactive
 * element.
 *
 * Bind the returned handlers on the board's viewport element
 * (`tabIndex={0}` so it can itself receive key events, and so focusin
 * bubbles from focusable descendants).
 */
export function useBoardKeyboard(viewportRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function panByScreenPx(dx: number, dy: number) {
      const { camera, setCamera } = useCameraStore.getState();
      setCamera({ ...camera, x: camera.x + dx / camera.zoom, y: camera.y + dy / camera.zoom });
    }

    function zoomAtCenter(factor: number) {
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

    function handleKeyDown(event: KeyboardEvent) {
      const { flyTo } = useCameraStore.getState();
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          panByScreenPx(-PAN_STEP_SCREEN_PX, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          panByScreenPx(PAN_STEP_SCREEN_PX, 0);
          break;
        case "ArrowUp":
          event.preventDefault();
          panByScreenPx(0, -PAN_STEP_SCREEN_PX);
          break;
        case "ArrowDown":
          event.preventDefault();
          panByScreenPx(0, PAN_STEP_SCREEN_PX);
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomAtCenter(ZOOM_STEP_FACTOR);
          break;
        case "-":
        case "_":
          event.preventDefault();
          zoomAtCenter(1 / ZOOM_STEP_FACTOR);
          break;
        case "0":
          event.preventDefault();
          void flyTo(getViewpoint("landing"), { reducedMotion });
          break;
        case "Escape":
          event.preventDefault();
          zoomAtCenter(0.5);
          break;
        default:
          break;
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;
      if (!el || !(target instanceof HTMLElement) || target === el) return;

      const { camera, viewport, flyTo } = useCameraStore.getState();
      const viewportRect = el.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const topLeft = screenToWorld(
        camera,
        targetRect.left - viewportRect.left,
        targetRect.top - viewportRect.top
      );
      const centerWorld = {
        x: topLeft.x + targetRect.width / 2 / camera.zoom,
        y: topLeft.y + targetRect.height / 2 / camera.zoom,
      };

      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      void flyTo(
        {
          x: centerWorld.x - viewport.width / (2 * camera.zoom),
          y: centerWorld.y - viewport.height / (2 * camera.zoom),
          zoom: camera.zoom,
        },
        { reducedMotion }
      );
    }

    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("focusin", handleFocusIn);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("focusin", handleFocusIn);
    };
  }, [viewportRef]);
}
