import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { DebugOverlay, isDebugOverlayEnabled } from "./DebugOverlay";
import { useCameraStore } from "./store";
import { useBoardGestures } from "./useBoardGestures";
import { useBoardKeyboard } from "./useBoardKeyboard";

export interface BoardProps {
  children?: ReactNode;
  className?: string;
}

const viewportStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  height: "100dvh",
  overflow: "hidden",
  touchAction: "none",
  // Owner request: the board's own empty backdrop (the world between/
  // behind regions) is white, not the app's dark --background token —
  // every region's own content (About/Contact's cards, Shop/Collage's
  // nodes, Gallery's poster card) is opaque and unaffected either way.
  backgroundColor: "#FFFFFF",
};

const worldStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  transformOrigin: "0 0",
  willChange: "transform",
};

/**
 * The canvas viewport + world. Per docs/02-canvas-spec.md §3, the transform
 * is driven by a single requestAnimationFrame loop that reads the camera
 * store directly (useCameraStore.getState()), not by subscribing to the
 * store and re-rendering React on every frame — that's what keeps panning
 * off the React render path.
 */
export function Board({ children, className }: BoardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const setViewport = useCameraStore((state) => state.setViewport);
  const { handleDoubleClick } = useBoardGestures(viewportRef);
  useBoardKeyboard(viewportRef);
  const [debugEnabled] = useState(() =>
    typeof window !== "undefined" ? isDebugOverlayEnabled() : false
  );

  // overscroll-behavior (pull-to-refresh / edge-swipe nav) and Safari's
  // gesturestart/change/end (its own pinch-zoom-the-page gesture) only
  // apply while the board is actually mounted — docs/02-canvas-spec.md §4.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";

    const preventSafariGesture = (event: Event) => event.preventDefault();
    el.addEventListener("gesturestart", preventSafariGesture);
    el.addEventListener("gesturechange", preventSafariGesture);
    el.addEventListener("gestureend", preventSafariGesture);

    return () => {
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      document.body.style.overscrollBehavior = previousOverscroll;
      el.removeEventListener("gesturestart", preventSafariGesture);
      el.removeEventListener("gesturechange", preventSafariGesture);
      el.removeEventListener("gestureend", preventSafariGesture);
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const updateSize = () => setViewport(el.clientWidth, el.clientHeight);
    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [setViewport]);

  // Keeps data-camera-* immediately accurate even if the rAF loop below
  // stalls under heavy load — confirmed root cause of e2e/canvas-gestures.
  // spec.ts's CI flakiness: an interaction (wheel/drag/keypress) updates
  // the camera store synchronously, but previously these attributes only
  // got painted on the loop's next tick, which real CI can delay past even
  // a 15s test timeout under parallel-worker CPU contention. Subscribes
  // directly to the store (zustand's vanilla subscribe, not the React
  // hook), so this never triggers a React re-render — same "no per-frame
  // React update" rule the rAF loop itself follows below, just immediate
  // instead of once-per-frame. The rAF loop still separately owns the
  // world transform and frameTimeMs; this only makes the e2e-observability
  // attributes it already wrote (see that loop's own comment) resilient to
  // paint timing.
  useEffect(() => {
    return useCameraStore.subscribe((state) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      viewport.dataset.cameraX = String(state.camera.x);
      viewport.dataset.cameraY = String(state.camera.y);
      viewport.dataset.cameraZoom = String(state.camera.zoom);
    });
  }, []);

  useEffect(() => {
    let frame: number;
    let lastFrameTime: number | null = null;

    function tick(now: number) {
      const world = worldRef.current;
      const viewport = viewportRef.current;
      if (world) {
        const { camera } = useCameraStore.getState();
        world.style.transform = `translate3d(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px, 0) scale(${camera.zoom})`;
        // Exposes camera state (and now frame time) on the DOM — cheap,
        // string formatting already happens above — so e2e specs can read
        // it without a window global, and the T3 debug overlay can poll it.
        if (viewport) {
          viewport.dataset.cameraX = String(camera.x);
          viewport.dataset.cameraY = String(camera.y);
          viewport.dataset.cameraZoom = String(camera.zoom);
          if (lastFrameTime != null) {
            viewport.dataset.frameTimeMs = (now - lastFrameTime).toFixed(2);
          }
        }
      }
      lastFrameTime = now;
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      ref={viewportRef}
      style={viewportStyle}
      className={className}
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
    >
      <div ref={worldRef} style={worldStyle}>
        {children}
      </div>
      {debugEnabled && <DebugOverlay />}
    </div>
  );
}
