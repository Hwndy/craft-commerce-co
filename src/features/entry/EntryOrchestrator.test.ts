import { describe, expect, it } from "vitest";

import { REDUCED_MOTION_TOTAL_MS, computeReducedMotionState } from "./EntryOrchestrator";

// `computeEntryState` and its own describe block are gone along with it —
// the full-motion case used to be driven by a fixed millisecond timing table
// matching CSS-faked rays/flood/luminous-swap sub-stages (docs/decisions.md);
// the owner's real transition video replaces all of that, so LandingVideo.tsx
// just plays the clip and waits for its own `ended` event. There's no
// elapsed-time curve left to unit-test for normal motion. Reduced motion
// still has one (a calm, instant cross-fade with no video played), covered
// below.
describe("computeReducedMotionState", () => {
  it("starts transitioning at t=0", () => {
    const state = computeReducedMotionState(0);
    expect(state.phase).toBe("transitioning");
    expect(state.floodOpacity).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it("cross-fades opacity from 0 to 1 over the reduced-motion duration", () => {
    expect(computeReducedMotionState(0).floodOpacity).toBe(0);
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS).floodOpacity).toBeCloseTo(1);
    const mid = computeReducedMotionState(REDUCED_MOTION_TOTAL_MS / 2).floodOpacity;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("reaches phase done once the short duration elapses", () => {
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS - 1).phase).toBe("transitioning");
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS - 1).isComplete).toBe(false);
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS).phase).toBe("done");
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS).isComplete).toBe(true);
  });

  it("clamps negative elapsed time to the start state", () => {
    expect(computeReducedMotionState(-500)).toEqual(computeReducedMotionState(0));
  });
});
