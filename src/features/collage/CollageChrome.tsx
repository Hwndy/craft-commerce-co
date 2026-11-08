import { useEffect, useState } from "react";

import { nearestViewpoint } from "@/canvas/nearestViewpoint";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint, listViewpoints } from "@/canvas/viewpoints";
import { zoomAtViewportCenter, ZOOM_STEP_FACTOR } from "@/canvas/zoomControl";
import { IconButton } from "@/components/brand/IconButton";
import { Button } from "@/components/ui/button";

import { useCollageViewStore } from "./collageViewStore";
import type { CollageLayoutMode } from "./lib/layout";
import { distinctShoots } from "./lib/shoots";
import { useCollagePhotos } from "./lib/useCollagePhotos";

const POLL_MS = 200;

/**
 * Fixed, screen-anchored chrome for the Collage screen only (Circle/
 * Diagonal-strips toggle, shoot-filter chips, zoom + Recentre) —
 * docs/decisions.md D-45. Rendered as a SIBLING of <Board> in Gallery.tsx,
 * never a descendant, for the same `position: fixed` containing-block
 * reason CanvasChrome is (D-44): Board's world div carries a `transform`,
 * which would otherwise drag this along with the camera instead of keeping
 * it screen-anchored.
 *
 * No top breadcrumb here — CanvasChrome's own top bar already names the
 * current region ("You are at: Collage"), so repeating it would just
 * duplicate text in the same corner. Every position below is chosen to
 * clear CanvasChrome's own fixed elements (its top bar, its bottom-20
 * minimap/Home, and its full-width guided-mode bottom bar), which render
 * at the same time this does and can't be told to make room.
 *
 * Polls the camera on an interval (not the React hook) to decide whether
 * the collage viewpoint is the nearest one, same reasoning as
 * CanvasChrome.tsx's own poll — this only needs to be roughly current, not
 * exact, and the hook would re-render every rAF frame during a flight/drag.
 */
export function CollageChrome() {
  const [isNearCollage, setIsNearCollage] = useState(false);
  const { data: photos } = useCollagePhotos();
  const layoutMode = useCollageViewStore((s) => s.layoutMode);
  const setLayoutMode = useCollageViewStore((s) => s.setLayoutMode);
  const activeShootId = useCollageViewStore((s) => s.activeShootId);
  const setActiveShootId = useCollageViewStore((s) => s.setActiveShootId);

  useEffect(() => {
    const interval = window.setInterval(() => {
      // Read fresh each tick, not once at mount: listViewpoints() returns
      // the small static fallback (landing/gallery/collage only) until the
      // DB-backed cache loads, and a stale mount-time snapshot would never
      // pick that up — CanvasChrome's own poll reads it fresh for the same
      // reason.
      const viewpoints = listViewpoints();
      const { camera, viewport } = useCameraStore.getState();
      const current = nearestViewpoint(camera, viewpoints, viewport.width, viewport.height);
      setIsNearCollage(current?.key === "collage");
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, []);

  if (!isNearCollage) return null;

  const shoots = distinctShoots(photos ?? []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] font-body text-sm text-foreground">
      {/* Stacked below CanvasChrome's own top-right cluster (Guided/Explore
       * + List view), not beside it — that corner is already full width. */}
      <div data-collage-chrome className="pointer-events-auto absolute right-4 top-20 flex items-center gap-1.5">
        {(["circular", "strips"] as const satisfies readonly CollageLayoutMode[]).map((candidate) => (
          <Button
            key={candidate}
            type="button"
            variant={layoutMode === candidate ? "pill" : "pill-outline"}
            size="sm"
            onClick={() => setLayoutMode(candidate)}
          >
            {candidate === "circular" ? "Circle" : "Diagonal strips"}
          </Button>
        ))}
      </div>

      {shoots.length > 1 && (
        // Stacked above CanvasChrome's minimap (bottom-20 left-4, ~100px
        // tall), not beside it — a variable-width, possibly-wrapping chip
        // row next to a fixed-width box risks running off narrow screens.
        <div data-collage-chrome className="pointer-events-auto absolute bottom-48 left-4 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={activeShootId === null ? "pill" : "pill-outline"}
            size="sm"
            onClick={() => setActiveShootId(null)}
          >
            All
          </Button>
          {shoots.map((shoot) => (
            <Button
              key={shoot.id}
              type="button"
              variant={activeShootId === shoot.id ? "pill" : "pill-outline"}
              size="sm"
              onClick={() => setActiveShootId(shoot.id)}
            >
              {shoot.title}
            </Button>
          ))}
        </div>
      )}

      {/* Stacked above CanvasChrome's Home (bottom-20 right-4), not beside
       * it. */}
      <div data-collage-chrome className="pointer-events-auto absolute bottom-36 right-4 flex items-center gap-2">
        <IconButton aria-label="Zoom out" size="sm" onClick={() => zoomAtViewportCenter(1 / ZOOM_STEP_FACTOR)}>
          −
        </IconButton>
        <IconButton aria-label="Zoom in" size="sm" onClick={() => zoomAtViewportCenter(ZOOM_STEP_FACTOR)}>
          +
        </IconButton>
        {/* Not labelled "Home": CanvasChrome already has a real "Home" button
         * (flies to landing) visible at the same time — this one only
         * recentres on the collage itself, so it needs its own name both
         * for clarity and so the two aren't accessible-name-ambiguous. */}
        <Button
          type="button"
          variant="pill"
          size="sm"
          onClick={() => {
            const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
            void useCameraStore.getState().flyTo(getViewpoint("collage"), { reducedMotion });
          }}
        >
          Recentre
        </Button>
      </div>
    </div>
  );
}
