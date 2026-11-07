import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { visibleWorldRect } from "./math";
import { nearestViewpoint } from "./nearestViewpoint";
import { useCameraStore } from "./store";
import type { Viewpoint } from "./types";
import { useGuidedModeStore } from "./useGuidedModeStore";
import { getViewpoint, listViewpoints } from "./viewpoints";

const POLL_MS = 200;
/** Default half-extent used to draw a region's box on the minimap — there's
 * no literal "region bounds" table, only viewpoints (a camera position);
 * this approximates the same 800x600 footprint Gallery.tsx's Region uses. */
const MINIMAP_REGION_WIDTH = 800;
const MINIMAP_REGION_HEIGHT = 600;
const MINIMAP_SIZE = { width: 140, height: 100 };

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

interface MinimapGeometry {
  viewpoints: Viewpoint[];
  worldToMinimap: (x: number, y: number) => { x: number; y: number };
}

function computeMinimapGeometry(viewpoints: Viewpoint[]): MinimapGeometry | null {
  if (viewpoints.length === 0) return null;

  const minX = Math.min(...viewpoints.map((v) => v.x - MINIMAP_REGION_WIDTH / 2));
  const maxX = Math.max(...viewpoints.map((v) => v.x + MINIMAP_REGION_WIDTH / 2));
  const minY = Math.min(...viewpoints.map((v) => v.y - MINIMAP_REGION_HEIGHT / 2));
  const maxY = Math.max(...viewpoints.map((v) => v.y + MINIMAP_REGION_HEIGHT / 2));
  const worldWidth = Math.max(1, maxX - minX);
  const worldHeight = Math.max(1, maxY - minY);
  const scale = Math.min(MINIMAP_SIZE.width / worldWidth, MINIMAP_SIZE.height / worldHeight);
  const offsetX = (MINIMAP_SIZE.width - worldWidth * scale) / 2;
  const offsetY = (MINIMAP_SIZE.height - worldHeight * scale) / 2;

  return {
    viewpoints,
    worldToMinimap: (x, y) => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY,
    }),
  };
}

/**
 * Minimap, region title, Home control, Guided/Explore switch with Next/
 * Previous and a progress indicator, and a polite live region announcing
 * the current viewpoint by label — docs/02-canvas-spec.md §6, §8, §9.
 *
 * Polls the camera store on an interval rather than subscribing through
 * the React hook (which would re-render every rAF frame during a flight
 * or drag, the anti-pattern Board.tsx's own transform loop avoids) or a
 * debounce (which is right for the precise "stable for 250ms" entry
 * threshold in useRegionEntry.ts, but this display only needs to be
 * roughly current, not exact).
 */
export function CanvasChrome() {
  const [camera, setCamera] = useState(() => useCameraStore.getState().camera);
  const [viewport, setViewport] = useState(() => useCameraStore.getState().viewport);
  const mode = useGuidedModeStore((s) => s.mode);
  // Subscribing to currentIndex (a primitive) is what actually triggers a
  // re-render when the guided position changes; progress() itself is called
  // fresh in the render body below. Selecting `(s) => s.progress()` instead
  // would build a new object every render, and Zustand's reference-equality
  // check would see that as "changed" forever — an infinite re-render loop,
  // caught by this component's own test.
  useGuidedModeStore((s) => s.currentIndex);
  const setMode = useGuidedModeStore((s) => s.setMode);
  const next = useGuidedModeStore((s) => s.next);
  const previous = useGuidedModeStore((s) => s.previous);
  const progress = useGuidedModeStore.getState().progress();

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = useCameraStore.getState();
      setCamera(state.camera);
      setViewport(state.viewport);
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const viewpoints = listViewpoints();
  const current = nearestViewpoint(camera, viewpoints, viewport.width, viewport.height);
  const geometry = computeMinimapGeometry(viewpoints);
  const visible = visibleWorldRect(camera, viewport.width, viewport.height);

  function flyToViewpoint(viewpoint: Viewpoint) {
    void useCameraStore.getState().flyTo(viewpoint, { reducedMotion: prefersReducedMotion() });
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: "sans-serif",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          aria-label="Home"
          onClick={() => flyToViewpoint(getViewpoint("landing"))}
          style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            color: "#fff",
            padding: "6px 12px",
            fontSize: 12,
          }}
        >
          Home
        </button>
        <span data-current-region-label style={{ fontSize: 13, fontWeight: 600 }}>
          {current?.label ?? ""}
        </span>
        <Link
          to="/list"
          style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            color: "#fff",
            padding: "6px 12px",
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          List view
        </Link>
      </div>

      {geometry && (
        <svg
          width={MINIMAP_SIZE.width}
          height={MINIMAP_SIZE.height}
          role="img"
          aria-label="Minimap"
          style={{ background: "rgba(0,0,0,0.6)", borderRadius: 6 }}
        >
          {geometry.viewpoints.map((v) => {
            const topLeft = geometry.worldToMinimap(v.x - MINIMAP_REGION_WIDTH / 2, v.y - MINIMAP_REGION_HEIGHT / 2);
            const bottomRight = geometry.worldToMinimap(
              v.x + MINIMAP_REGION_WIDTH / 2,
              v.y + MINIMAP_REGION_HEIGHT / 2
            );
            return (
              <rect
                key={v.key}
                x={topLeft.x}
                y={topLeft.y}
                width={Math.max(1, bottomRight.x - topLeft.x)}
                height={Math.max(1, bottomRight.y - topLeft.y)}
                fill={v.key === current?.key ? "rgba(201,166,75,0.5)" : "rgba(255,255,255,0.15)"}
                stroke="rgba(255,255,255,0.4)"
                style={{ cursor: "pointer" }}
                onClick={() => flyToViewpoint(v)}
              />
            );
          })}
          {(() => {
            const topLeft = geometry.worldToMinimap(visible.x, visible.y);
            const bottomRight = geometry.worldToMinimap(visible.x + visible.width, visible.y + visible.height);
            return (
              <rect
                x={topLeft.x}
                y={topLeft.y}
                width={Math.max(1, bottomRight.x - topLeft.x)}
                height={Math.max(1, bottomRight.y - topLeft.y)}
                fill="none"
                stroke="#fff"
                strokeWidth={1.5}
                pointerEvents="none"
              />
            );
          })()}
        </svg>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={() => setMode(mode === "guided" ? "explore" : "guided")}
          style={{
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            color: "#fff",
            padding: "4px 10px",
            fontSize: 11,
          }}
        >
          {mode === "guided" ? "Guided" : "Explore"}
        </button>
        {mode === "guided" && (
          <>
            <button type="button" aria-label="Previous" onClick={() => void previous()} style={navButtonStyle}>
              ‹
            </button>
            <span style={{ fontSize: 11 }}>
              {progress.index} of {progress.total}
            </span>
            <button type="button" aria-label="Next" onClick={() => void next()} style={navButtonStyle}>
              ›
            </button>
          </>
        )}
      </div>

      <div aria-live="polite" className="sr-only">
        {current ? `Entering ${current.label}` : ""}
      </div>
    </div>
  );
}

const navButtonStyle = {
  background: "rgba(0,0,0,0.6)",
  border: "1px solid rgba(255,255,255,0.4)",
  borderRadius: 999,
  color: "#fff",
  width: 24,
  height: 24,
  fontSize: 14,
  lineHeight: 1,
} as const;
