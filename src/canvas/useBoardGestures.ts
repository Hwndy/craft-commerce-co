import { useGesture } from "@use-gesture/react";
import { useRef } from "react";

import { exponentialDecay, zoomAboutPoint } from "./math";
import { useCameraStore } from "./store";

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const DOUBLE_CLICK_ZOOM_FACTOR = 2;
const INERTIA_MIN_SPEED = 20; // world units/sec; below this, stop the inertia loop
const INERTIA_HALF_LIFE_SECONDS = 0.25;

/**
 * Found in review (Greptile, PR #3): About/Contact's panels (T6) can shrink
 * below their content's natural height on short viewports and rely on their
 * own `overflow-y-auto` to let a visitor reach the rest — but the board's
 * wheel listener lives on the viewport element itself, which every wheel
 * event bubbles up to regardless of where it started, so it was zooming the
 * board instead of letting the panel scroll. `src/canvas` can't import the
 * feature components to know which of their elements are scrollable
 * (CLAUDE.md), so this is the registration point: any feature marks its own
 * scrollable container with `data-board-scrollable`, and this hook lets the
 * wheel event scroll it natively — only falling through to zoom once that
 * element has no more room to scroll in the requested direction (so, e.g.,
 * scrolling past the top/bottom of a panel still zooms the board).
 */
function findScrollableAncestor(target: EventTarget | null, boundary: Element | null): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el !== boundary) {
    if (el instanceof HTMLElement && el.hasAttribute("data-board-scrollable")) return el;
    el = el.parentElement;
  }
  return null;
}

function canScrollFurther(el: HTMLElement, dy: number): boolean {
  if (dy < 0) return el.scrollTop > 0;
  if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight;
  return false;
}

/**
 * Pointer drag, wheel zoom (incl. ctrlKey trackpad pinch), touch pinch,
 * double-click/double-tap zoom and drag inertia, bound to the board's
 * viewport element. docs/02-canvas-spec.md §4.
 *
 * Returns `bind()` from @use-gesture/react — spread it on the viewport
 * element: `<div {...bind()}>`.
 */
export function useBoardGestures(viewportRef: React.RefObject<HTMLElement>) {
  const pinchStartZoom = useRef(1);
  const inertiaFrame = useRef<number | null>(null);

  function stopInertia() {
    if (inertiaFrame.current != null) {
      cancelAnimationFrame(inertiaFrame.current);
      inertiaFrame.current = null;
    }
  }

  function startInertia(vx: number, vy: number) {
    stopInertia();
    let lastTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let velocity = { x: vx, y: vy };

    function step(now: number) {
      const dtSeconds = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;

      const { camera, setCamera } = useCameraStore.getState();
      setCamera({
        ...camera,
        x: camera.x - (velocity.x * dtSeconds) / camera.zoom,
        y: camera.y - (velocity.y * dtSeconds) / camera.zoom,
      });

      velocity = {
        x: exponentialDecay(velocity.x, dtSeconds, INERTIA_HALF_LIFE_SECONDS),
        y: exponentialDecay(velocity.y, dtSeconds, INERTIA_HALF_LIFE_SECONDS),
      };

      if (Math.hypot(velocity.x, velocity.y) > INERTIA_MIN_SPEED) {
        inertiaFrame.current = requestAnimationFrame(step);
      } else {
        inertiaFrame.current = null;
      }
    }

    inertiaFrame.current = requestAnimationFrame(step);
  }

  function zoomTo(targetZoom: number, sx: number, sy: number) {
    const { camera, setCamera, zoomLimits } = useCameraStore.getState();
    setCamera(zoomAboutPoint(camera, sx, sy, targetZoom, zoomLimits));
  }

  // With `target` set below, @use-gesture attaches its listeners directly
  // to the ref itself — nothing needs to be spread onto JSX.
  useGesture(
    {
      onDragStart: () => stopInertia(),
      onDrag: ({ delta: [dx, dy], last, velocity: [sx, sy], direction: [dirx, diry], pinching }) => {
        if (pinching) return;
        const { camera, setCamera } = useCameraStore.getState();
        setCamera({
          ...camera,
          x: camera.x - dx / camera.zoom,
          y: camera.y - dy / camera.zoom,
        });
        if (last) {
          // use-gesture's velocity is a magnitude; direction gives the sign.
          // Convert to screen px/sec for startInertia's per-second decay math.
          const pxPerMs = 1000;
          startInertia(sx * dirx * pxPerMs, sy * diry * pxPerMs);
        }
      },
      onWheel: ({ event, delta: [, dy] }) => {
        if (!event.ctrlKey) {
          const scrollable = findScrollableAncestor(event.target, viewportRef.current);
          if (scrollable && canScrollFurther(scrollable, dy)) return;
        }
        event.preventDefault();
        stopInertia();
        const rect = viewportRef.current?.getBoundingClientRect();
        const sx = rect ? event.clientX - rect.left : 0;
        const sy = rect ? event.clientY - rect.top : 0;
        const { camera } = useCameraStore.getState();
        const targetZoom = camera.zoom * Math.exp(-dy * WHEEL_ZOOM_SENSITIVITY);
        zoomTo(targetZoom, sx, sy);
      },
      onPinchStart: () => {
        stopInertia();
        pinchStartZoom.current = useCameraStore.getState().camera.zoom;
      },
      onPinch: ({ origin: [ox, oy], offset: [scale], first }) => {
        if (first) pinchStartZoom.current = useCameraStore.getState().camera.zoom;
        const rect = viewportRef.current?.getBoundingClientRect();
        const sx = rect ? ox - rect.left : ox;
        const sy = rect ? oy - rect.top : oy;
        zoomTo(pinchStartZoom.current * scale, sx, sy);
      },
    },
    {
      target: viewportRef,
      eventOptions: { passive: false },
      drag: { from: () => [0, 0] },
      pinch: { scaleBounds: { min: 0.1, max: 40 } },
    }
  );

  function handleDoubleClick(event: React.MouseEvent) {
    stopInertia();
    const rect = viewportRef.current?.getBoundingClientRect();
    const sx = rect ? event.clientX - rect.left : 0;
    const sy = rect ? event.clientY - rect.top : 0;
    const { camera } = useCameraStore.getState();
    zoomTo(camera.zoom * DOUBLE_CLICK_ZOOM_FACTOR, sx, sy);
  }

  return { handleDoubleClick, stopInertia };
}
