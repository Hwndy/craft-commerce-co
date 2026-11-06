import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { useCameraStore } from "./store";

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

  useEffect(() => {
    let frame: number;

    function tick() {
      const world = worldRef.current;
      if (world) {
        const { camera } = useCameraStore.getState();
        world.style.transform = `translate3d(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px, 0) scale(${camera.zoom})`;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={viewportRef} style={viewportStyle} className={className}>
      <div ref={worldRef} style={worldStyle}>
        {children}
      </div>
    </div>
  );
}
