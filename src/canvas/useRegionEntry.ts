import { useEffect, useRef, useState } from "react";

import { DEFAULT_COVERAGE_THRESHOLD, DEFAULT_STABLE_MS, hasEnteredRegion } from "./regionEntry";
import { useCameraStore } from "./store";
import type { Rect } from "./types";

export interface UseRegionEntryOptions {
  threshold?: number;
  stableMs?: number;
}

/**
 * Whether `regionRect` currently counts as "entered" (docs/02-canvas-
 * spec.md §5): its on-screen coverage is at or above `threshold` (default
 * 70%) and the camera has gone `stableMs` (default 250ms) without
 * changing. Implemented as a debounce — every camera-store change resets
 * a stableMs timer; coverage is only (re-)evaluated once that timer
 * actually fires, i.e. once nothing has changed for that long — rather
 * than polling on an interval, which would either lag behind a true
 * "stable" moment or fire needlessly often.
 *
 * This is the detection mechanism only. What a feature does on entering
 * (reveal a full-screen mode, update the URL) is up to the caller — e.g.
 * src/features/film/FilmStage.tsx's reveal()/hide() today are triggered
 * by Gallery.tsx's own mount lifecycle, not by this hook; wiring real
 * camera-driven entry into Gallery (and other regions) is T5's job, once
 * viewpoint-driven navigation and properly-sized region geometry exist —
 * rewiring Gallery's trigger now, before that groundwork lands, would
 * risk its already-verified gate/entry-sequence behaviour for no benefit.
 */
export function useRegionEntry(regionRect: Rect, options: UseRegionEntryOptions = {}): boolean {
  const threshold = options.threshold ?? DEFAULT_COVERAGE_THRESHOLD;
  const stableMs = options.stableMs ?? DEFAULT_STABLE_MS;
  const [isEntered, setIsEntered] = useState(false);
  const timerRef = useRef<number | null>(null);

  const { x, y, width, height } = regionRect;

  useEffect(() => {
    function evaluate() {
      const { camera, viewport } = useCameraStore.getState();
      if (viewport.width === 0 && viewport.height === 0) return;
      setIsEntered(hasEnteredRegion({ x, y, width, height }, camera, viewport.width, viewport.height, threshold));
    }

    function scheduleEvaluate() {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        evaluate();
      }, stableMs);
    }

    scheduleEvaluate();
    const unsubscribe = useCameraStore.subscribe(scheduleEvaluate);
    return () => {
      unsubscribe();
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [x, y, width, height, threshold, stableMs]);

  return isEntered;
}
