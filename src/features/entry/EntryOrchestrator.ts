/**
 * Pure time -> state mapping for the entry sequence. Kept free of timers/
 * DOM so it's trivially unit-testable; `useEntryOrchestrator` (a React
 * hook) drives the reduced-motion case from requestAnimationFrame.
 *
 * The full-motion case used to be driven by a fixed millisecond timing
 * table matching CSS-faked rays/flood/luminous-swap sub-stages (docs/
 * decisions.md's own history) — gone now that the owner's real transition
 * video replaces all of that: LandingVideo.tsx just plays the clip and
 * waits for its own `ended` event, so there's no elapsed-time curve left
 * to compute for normal motion at all. Reduced motion still needs one (a
 * calm, instant cross-fade with no video played), so that's all that's
 * left here.
 */
import { easeInOutCubic } from "@/canvas/math";

import type { EntryState } from "./types";

export const REDUCED_MOTION_TOTAL_MS = 400;

/** The reduced-motion entry sequence: a single short cross-fade, no rays/ramp. */
export function computeReducedMotionState(elapsedMs: number): EntryState {
  const clampedElapsed = Math.max(0, elapsedMs);
  const t = Math.min(1, clampedElapsed / REDUCED_MOTION_TOTAL_MS);
  const opacity = easeInOutCubic(t);
  return {
    phase: clampedElapsed >= REDUCED_MOTION_TOTAL_MS ? "done" : "transitioning",
    elapsedMs: clampedElapsed,
    floodOpacity: opacity,
    isComplete: clampedElapsed >= REDUCED_MOTION_TOTAL_MS,
  };
}
