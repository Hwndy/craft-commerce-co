import { useEffect, useRef, useState } from "react";
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
/** Client feedback (docs/decisions.md D-71): fade the minimap out after
 * this long with no camera movement, show it again the moment the camera
 * moves. */
const MINIMAP_FADE_MS = 3000;
const CAMERA_MOVE_EPSILON = 0.5;
/** Default half-extent used to draw a region's box on the minimap — there's
 * no literal "region bounds" table, only viewpoints (a camera position);
 * this approximates the same 800x600 footprint Gallery.tsx's Region uses. */
const MINIMAP_REGION_WIDTH = 800;
const MINIMAP_REGION_HEIGHT = 600;
const MINIMAP_SIZE = { width: 140, height: 100 };
// Client feedback, 21 Nov 2026 (docs/decisions.md D-80): board-chrome
// headings/labels now use the Shop's own already-established palette
// instead of gold — shop-accent-pink's real rgb (#F10044), not a new colour.
const ACCENT = "241,0,68";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

interface MinimapGeometry {
  viewpoints: Viewpoint[];
  worldToMinimap: (x: number, y: number) => { x: number; y: number };
}

/**
 * Two viewpoints at the exact same world position (docs/decisions.md D-78:
 * "shop-wall"/"shop-floor" both point at the one Shop room now) would
 * otherwise draw two identical, perfectly stacked `<rect>`s here — found
 * in review (CodeRabbit, PR #30): the minimap renders every entry from
 * `listViewpoints()`, not just the guided-path ones, so `shop-floor`'s own
 * `inGuidedPath: false` (which only filters Next/Previous and the bottom
 * region-tab row) doesn't stop it from still getting a redundant, invisibly
 * overlapping clickable rect here. Keeps the first viewpoint at each
 * distinct (x, y) — `listViewpoints()`'s own sortOrder means that's
 * "shop-wall" ("The Shop"), the one actually in the guided path.
 */
function dedupeByPosition(viewpoints: Viewpoint[]): Viewpoint[] {
  const seen = new Set<string>();
  return viewpoints.filter((v) => {
    const key = `${v.x},${v.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeMinimapGeometry(allViewpoints: Viewpoint[]): MinimapGeometry | null {
  if (allViewpoints.length === 0) return null;
  const viewpoints = dedupeByPosition(allViewpoints);

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
 * bottom-left minimap, and a bottom bar (Previous, region tabs, a
 * "Next: <region>" CTA) — docs/02-canvas-spec.md §6, §8, §9, restyled per
 * the owner's design upload (docs/decisions.md D-45; re-themed off gold
 * per D-80).
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

  const [minimapVisible, setMinimapVisible] = useState(true);
  const lastCameraRef = useRef(camera);
  const lastMovedAtRef = useRef(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = useCameraStore.getState();
      setCamera(state.camera);
      setViewport(state.viewport);

      const prev = lastCameraRef.current;
      const moved =
        Math.abs(state.camera.x - prev.x) > CAMERA_MOVE_EPSILON ||
        Math.abs(state.camera.y - prev.y) > CAMERA_MOVE_EPSILON ||
        Math.abs(state.camera.zoom - prev.zoom) > CAMERA_MOVE_EPSILON;
      lastCameraRef.current = state.camera;

      if (moved) {
        lastMovedAtRef.current = Date.now();
        setMinimapVisible(true);
      } else if (Date.now() - lastMovedAtRef.current > MINIMAP_FADE_MS) {
        setMinimapVisible(false);
      }
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
    // cameraForViewpoint centres the landing camera for Contact (T6,
    // alongside About until docs/decisions.md D-71's Step 9 removed it)
    // specifically — a no-op for every other region, so their own
    // already-tested landing positions are unchanged (found in review,
    // Greptile/CodeRabbit, PR #3: the minimap and region-tab clicks here
    // share the exact same off-centre bug the direct /about, /contact
    // deep links had).
    void flyTo(cameraForViewpoint(viewpoint, viewport), { reducedMotion: prefersReducedMotion() });
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] font-body text-sm text-shop-ink">
      {/* Top bar: wordmark + current region (left), Guided/Explore (right).
          data-canvas-chrome marks each real interactive region (not this
          outer inset-0 wrapper, whose own box would cover the whole
          viewport) so e2e specs can check a candidate element against
          CanvasChrome's actual footprint — see e2e/photo-viewer.spec.ts.

          Client feedback (docs/decisions.md D-71): "remove header but keep
          everything in it" — the previous fully-opaque bg-background bar
          (a deliberate fix for a real measured 2.38:1 contrast failure
          once a translucent bar blended toward a white canvas, D-61) is
          replaced with a top-anchored gradient scrim + backdrop-blur
          instead of a hard flat rectangle: still opaque enough right
          behind the text (from-background/85) to hold the same contrast
          guarantee, fading to transparent by the bar's own bottom edge so
          there's no visible "bar" shape against the canvas.

          Client feedback, 18 Nov 2026 (docs/decisions.md): "the header too
          thick, taking too much space... minimise the noise and
          distractions" — confirmed in the client's own phone recordings.
          Shrunk the padding, seal icon and gap so the bar's own real
          footprint (and therefore the gradient fade's height, which spans
          this element's own box) takes noticeably less of the screen,
          without dropping anything it holds.

          Client feedback, 21 Nov 2026 (docs/decisions.md D-80): "all
          headings and labels should use this colour scheme" — the
          gold-on-dark bar (from-background/85, a measured D-61 contrast
          fix) is now a light shop-cream one instead, with shop-ink text
          (computed at 16.6:1 against shop-cream — comfortably clears the
          4.5:1 D-61 was fixing for in the first place, so that fix's own
          reasoning still holds, just inverted light/dark). */}
      <div
        data-canvas-chrome
        className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-shop-cream/90 via-shop-cream/60 to-transparent p-2.5 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          {/* Client feedback: the seal redirects to the landing page;
              grayscale recolours it black/white as a CSS filter rather
              than a new asset, since no black-and-white source image
              exists to swap in. Scoped to just the seal, not the whole
              breadcrumb, per the client's own literal wording. */}
          <Link to="/" aria-label="Go to the landing page">
            <img
              src="/videos/all_life_poster.jpg"
              alt=""
              className="h-6 w-6 rounded-full border border-shop-accent-pink/50 object-cover grayscale"
            />
          </Link>
          <span className="font-heading text-xs font-bold uppercase tracking-wider">ALL LIFE WORKS</span>
          <span className="hidden text-xs text-shop-ink/70 sm:inline">You are at</span>
          {/* shop-peg (#8C5A66), not shop-accent-pink: the only other
              palette colour (besides shop-ink itself) that actually passes
              4.5:1 as real text on this light background (computed: 5.0:1
              on shop-cream) — accent-pink/teal/gold all fall under 4.5:1
              as text here, so they're reserved for borders/fills (D-80). */}
          <span data-current-region-label className="text-xs font-semibold text-shop-peg">
            {current?.label ?? ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={mode === "guided" ? "chrome-pill" : "chrome-pill-outline"}
            size="sm"
            onClick={() => setMode(mode === "guided" ? "explore" : "guided")}
          >
            {mode === "guided" ? "Guided" : "Explore"}
          </Button>
        </div>
      </div>

      {/* Minimap, bottom-left. Client feedback (D-71): fades after 3s idle,
          shows again on camera movement or while the pointer is over it
          (so it can still be deliberately brought back, not just flashed
          on and gone again). */}
      {geometry && (
        <div
          data-canvas-chrome
          className="pointer-events-auto absolute bottom-20 left-4 transition-opacity duration-500"
          style={{ opacity: minimapVisible ? 1 : 0 }}
          onPointerEnter={() => setMinimapVisible(true)}
        >
          {/* bg-shop-cream, not bg-background (D-80) — the rect
              strokes/fills below were tuned for a dark minimap (white-ish
              strokes at low opacity); flipped to shop-ink-based strokes so
              they're still visible against the new light background. */}
          <svg
            width={MINIMAP_SIZE.width}
            height={MINIMAP_SIZE.height}
            role="img"
            aria-label="Minimap"
            className="rounded-md bg-shop-cream/80 backdrop-blur-sm"
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
                  fill={v.key === current?.key ? `rgba(${ACCENT},0.4)` : "rgba(21,19,15,0.1)"}
                  stroke="rgba(21,19,15,0.4)"
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
                  stroke="#15130F"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })()}
          </svg>
        </div>
      )}

      {/* Bottom bar: Previous + progress (left), region tabs (centre), Next
          CTA (right) — guided mode only. bg-shop-cream, not bg-background
          (D-80) — kept fully opaque, same as before: D-61's own lesson
          ("a translucent background is only as dark/light as whatever
          sits behind it") applies just as much flipped light-on-light, and
          this bar's text needs a guaranteed ratio regardless of backdrop. */}
      {mode === "guided" && (
        <div
          data-canvas-chrome
          className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-shop-cream p-4"
        >
          <div className="flex items-center gap-2">
            <IconButton variant="chrome-pill-outline" aria-label="Previous" size="sm" onClick={() => void previous()}>
              ‹
            </IconButton>
            <span className="text-xs text-shop-ink/70">
              {progress.index} of {progress.total}
            </span>
          </div>

          {path.length > 0 && (
            <div className="hidden items-center gap-1.5 overflow-x-auto md:flex">
              {path.map((v) => (
                <Button
                  key={v.key}
                  type="button"
                  variant={v.key === current?.key ? "chrome-pill" : "chrome-pill-outline"}
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

          <Button type="button" variant="chrome-pill" onClick={() => void next()}>
            {nextViewpoint ? `Next: ${nextViewpoint.label}` : "Next"}
          </Button>
        </div>
      )}

      {/* Home (recentre) — the mockup's crosshair icon in its zoom-control
          cluster, bottom-right. Mirrors the minimap's bottom-20 so it
          clears the bottom bar's "Next" CTA in the same corner. */}
      <div data-canvas-chrome className="pointer-events-auto absolute bottom-20 right-4">
        <IconButton variant="chrome-pill-outline" aria-label="Home" onClick={() => flyToViewpoint(getViewpoint("landing"))}>
          ⊙
        </IconButton>
      </div>

      <div aria-live="polite" className="sr-only">
        {current ? `Entering ${current.label}` : ""}
      </div>
    </div>
  );
}
