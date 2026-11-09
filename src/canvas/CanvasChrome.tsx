import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { IconButton } from "@/components/brand/IconButton";
import { Button } from "@/components/ui/button";

import { guidedPathViewpoints } from "./guidedPath";
import { visibleWorldRect } from "./math";
import { nearestViewpoint } from "./nearestViewpoint";
import { useCameraStore } from "./store";
import type { Viewpoint } from "./types";
import { useGuidedModeStore } from "./useGuidedModeStore";
import { cameraForViewpoint, getViewpoint, listViewpoints } from "./viewpoints";

const POLL_MS = 200;
/** Default half-extent used to draw a region's box on the minimap — there's
 * no literal "region bounds" table, only viewpoints (a camera position);
 * this approximates the same 800x600 footprint Gallery.tsx's Region uses. */
const MINIMAP_REGION_WIDTH = 800;
const MINIMAP_REGION_HEIGHT = 600;
const MINIMAP_SIZE = { width: 140, height: 100 };
const GOLD = "255,217,0";

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
 * Top bar (wordmark, current region, Guided/Explore, List view), a
 * bottom-left minimap, and a bottom bar (Previous, region tabs, a gold
 * "Next: <region>" CTA) — docs/02-canvas-spec.md §6, §8, §9, restyled per
 * the owner's design upload (docs/decisions.md D-45).
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
  const currentIndex = useGuidedModeStore((s) => s.currentIndex);
  const setMode = useGuidedModeStore((s) => s.setMode);
  const setGuidedIndex = useGuidedModeStore((s) => s.setIndex);
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
  const path = guidedPathViewpoints(viewpoints);
  // Not the clamped next() target — path[currentIndex] directly, so the
  // button's own label can tell "there's nowhere further to go" (undefined)
  // apart from "the next stop is this one" (a real Viewpoint).
  const nextViewpoint = path[currentIndex + 1];

  function flyToViewpoint(viewpoint: Viewpoint) {
    const { viewport, flyTo } = useCameraStore.getState();
    // cameraForViewpoint centres the landing camera for About/Contact
    // (T6) specifically — a no-op for every other region, so their own
    // already-tested landing positions are unchanged (found in review,
    // Greptile/CodeRabbit, PR #3: the minimap and region-tab clicks here
    // share the exact same off-centre bug the direct /about, /contact
    // deep links had).
    void flyTo(cameraForViewpoint(viewpoint, viewport), { reducedMotion: prefersReducedMotion() });
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] font-body text-sm text-foreground">
      {/* Top bar: wordmark + current region (left), Guided/Explore + List view (right).
          data-canvas-chrome marks each real interactive region (not this
          outer inset-0 wrapper, whose own box would cover the whole
          viewport) so e2e specs can check a candidate element against
          CanvasChrome's actual footprint — see e2e/photo-viewer.spec.ts.
          Fully opaque bg-background (not the minimap's /70 translucent
          convention) — found via real CI (axe, not just review): this
          bar's own text has no background of its own, so a translucent
          dark bar still blends toward white once the canvas itself turns
          white (D-61), diluting text-muted-foreground to a measured
          2.38:1 contrast against a ~#5b5b5b blend — short of WCAG AA's
          4.5:1. An opaque background can't dilute regardless of what's
          behind it. */}
      <div
        data-canvas-chrome
        className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-background p-4"
      >
        <div className="flex items-center gap-3">
          <img
            src="/videos/all_life_poster.jpg"
            alt=""
            className="h-8 w-8 rounded-full border border-primary/50 object-cover"
          />
          <span className="font-heading text-sm font-bold uppercase tracking-wider">ALL LIFE</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">You are at</span>
          <span data-current-region-label className="text-sm font-semibold text-primary">
            {current?.label ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === "guided" ? "pill" : "pill-outline"}
            size="sm"
            onClick={() => setMode(mode === "guided" ? "explore" : "guided")}
          >
            {mode === "guided" ? "Guided" : "Explore"}
          </Button>
          <Button asChild variant="pill-outline" size="sm">
            <Link to="/list">List view</Link>
          </Button>
        </div>
      </div>

      {/* Minimap, bottom-left. */}
      {geometry && (
        <div data-canvas-chrome className="pointer-events-auto absolute bottom-20 left-4">
          <svg
            width={MINIMAP_SIZE.width}
            height={MINIMAP_SIZE.height}
            role="img"
            aria-label="Minimap"
            className="rounded-md bg-background/70 backdrop-blur-sm"
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
                  fill={v.key === current?.key ? `rgba(${GOLD},0.5)` : "rgba(255,255,255,0.15)"}
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
        </div>
      )}

      {/* Bottom bar: Previous + progress (left), region tabs (centre), gold Next CTA (right) — guided mode only. */}
      {mode === "guided" && (
        <div
          data-canvas-chrome
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-background p-4"
        >
          <div className="flex items-center gap-2">
            <IconButton aria-label="Previous" size="sm" onClick={() => void previous()}>
              ‹
            </IconButton>
            <span className="text-xs text-muted-foreground">
              {progress.index} of {progress.total}
            </span>
          </div>

          {path.length > 0 && (
            <div className="hidden items-center gap-1.5 overflow-x-auto md:flex">
              {path.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant={v.key === current?.key ? "pill" : "pill-outline"}
                  size="sm"
                  onClick={() => {
                    // Keep currentIndex in step with a direct tab jump, not
                    // just the camera — otherwise Next/Previous and the
                    // progress indicator keep pointing at wherever Guided
                    // mode last left off, not here (found in review).
                    setGuidedIndex(path.indexOf(v));
                    flyToViewpoint(v);
                  }}
                >
                  {v.label}
                </Button>
              ))}
            </div>
          )}

          <Button type="button" variant="pill" onClick={() => void next()}>
            {nextViewpoint ? `Next: ${nextViewpoint.label}` : "Next"}
          </Button>
        </div>
      )}

      {/* Home (recentre) — the mockup's crosshair icon in its zoom-control
          cluster, bottom-right. Mirrors the minimap's bottom-20 so it
          clears the bottom bar's "Next" CTA in the same corner. */}
      <div data-canvas-chrome className="pointer-events-auto absolute bottom-20 right-4">
        <IconButton aria-label="Home" onClick={() => flyToViewpoint(getViewpoint("landing"))}>
          ⊙
        </IconButton>
      </div>

      <div aria-live="polite" className="sr-only">
        {current ? `Entering ${current.label}` : ""}
      </div>
    </div>
  );
}
