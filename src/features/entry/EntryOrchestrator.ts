/**
 * Pure time -> state mapping for the entry sequence, per the timing table
 * in docs/04-design-and-motion.md §3. Kept free of timers/DOM so it's
 * trivially unit-testable; `useEntryOrchestrator` (a React hook) drives it
 * from requestAnimationFrame.
 */
import { easeInOutCubic } from "@/canvas/math";

import type { EntryPhase, EntryState } from "./types";

// Milestones in ms, from docs/04-design-and-motion.md §3's timing table.
const SPEED_RAMP_END = 2500;
const RAYS_START = 800;
const RAYS_FULL = 4000;
const FLOOD_START = 3000;
const FLOOD_FULL = 5500;
const LUMINOUS_START = 4500;
const LUMINOUS_FULL = 5500;
const HOLD_END = 6100;
const REVEAL_END = 7300;

export const ENTRY_TOTAL_MS = REVEAL_END;
export const ENTRY_MAX_SPEED = 6;
export const REDUCED_MOTION_TOTAL_MS = 400;

function rampBetween(elapsedMs: number, start: number, end: number): number {
  if (elapsedMs <= start) return 0;
  if (elapsedMs >= end) return 1;
  return easeInOutCubic((elapsedMs - start) / (end - start));
}

function phaseFor(elapsedMs: number): EntryPhase {
  if (elapsedMs <= 0) return "idle";
  if (elapsedMs < SPEED_RAMP_END) return "accelerating";
  if (elapsedMs < LUMINOUS_START) return "burst";
  if (elapsedMs < HOLD_END) return "flood";
  if (elapsedMs < REVEAL_END) return "reveal";
  return "done";
}

/** The full (motion-enabled) entry sequence. */
export function computeEntryState(elapsedMs: number): EntryState {
  const clampedElapsed = Math.max(0, elapsedMs);
  const phase = phaseFor(clampedElapsed);

  const speedMultiplier =
    1 + (ENTRY_MAX_SPEED - 1) * rampBetween(clampedElapsed, 0, SPEED_RAMP_END);

  const rayIntensity =
    phase === "reveal" || phase === "done"
      ? 1 - rampBetween(clampedElapsed, HOLD_END, REVEAL_END)
      : rampBetween(clampedElapsed, RAYS_START, RAYS_FULL);

  const floodRising = rampBetween(clampedElapsed, FLOOD_START, FLOOD_FULL);
  const floodFalling = rampBetween(clampedElapsed, HOLD_END, REVEAL_END);
  const floodOpacity =
    clampedElapsed < HOLD_END ? floodRising : 1 - floodFalling;

  const luminousAmount = rampBetween(clampedElapsed, LUMINOUS_START, LUMINOUS_FULL);

  return {
    phase,
    elapsedMs: clampedElapsed,
    speedMultiplier,
    rayIntensity,
    floodOpacity,
    luminousAmount,
    isComplete: clampedElapsed >= REVEAL_END,
  };
}

/** The reduced-motion entry sequence: a single short cross-fade, no rays/ramp. */
export function computeReducedMotionState(elapsedMs: number): EntryState {
  const clampedElapsed = Math.max(0, elapsedMs);
  const t = Math.min(1, clampedElapsed / REDUCED_MOTION_TOTAL_MS);
  const opacity = easeInOutCubic(t);
  return {
    phase: clampedElapsed >= REDUCED_MOTION_TOTAL_MS ? "done" : "reveal",
    elapsedMs: clampedElapsed,
    speedMultiplier: 1,
    rayIntensity: 0,
    floodOpacity: opacity,
    luminousAmount: 0,
    isComplete: clampedElapsed >= REDUCED_MOTION_TOTAL_MS,
  };
}
