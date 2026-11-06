import { describe, expect, it } from "vitest";

import {
  ENTRY_TOTAL_MS,
  REDUCED_MOTION_TOTAL_MS,
  computeEntryState,
  computeReducedMotionState,
} from "./EntryOrchestrator";

describe("computeEntryState", () => {
  it("starts idle at t=0 with speed 1x and everything else at 0", () => {
    const state = computeEntryState(0);
    expect(state.phase).toBe("idle");
    expect(state.speedMultiplier).toBeCloseTo(1);
    expect(state.rayIntensity).toBe(0);
    expect(state.floodOpacity).toBe(0);
    expect(state.luminousAmount).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it("ramps speed toward 6x by the end of the speed-ramp window", () => {
    expect(computeEntryState(2500).speedMultiplier).toBeCloseTo(6, 1);
    // Partway through the ramp it should be strictly between 1 and 6.
    const mid = computeEntryState(1250).speedMultiplier;
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(6);
  });

  it("holds speed at 6x for the rest of the sequence", () => {
    expect(computeEntryState(4000).speedMultiplier).toBeCloseTo(6);
    expect(computeEntryState(6000).speedMultiplier).toBeCloseTo(6);
  });

  it("brings rays in from ~0.8s and holds them through the flood", () => {
    expect(computeEntryState(500).rayIntensity).toBe(0);
    expect(computeEntryState(4000).rayIntensity).toBeCloseTo(1);
    expect(computeEntryState(5000).rayIntensity).toBeCloseTo(1);
  });

  it("fades rays out again during the reveal", () => {
    expect(computeEntryState(6100).rayIntensity).toBeCloseTo(1);
    expect(computeEntryState(7300).rayIntensity).toBeCloseTo(0);
  });

  it("swaps in the luminous form between 4.5s and 5.5s", () => {
    expect(computeEntryState(4500).luminousAmount).toBe(0);
    expect(computeEntryState(5500).luminousAmount).toBeCloseTo(1);
    const mid = computeEntryState(5000).luminousAmount;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("floodOpacity never decreases before the reveal phase begins", () => {
    let prev = -Infinity;
    for (let ms = 0; ms <= 6100; ms += 50) {
      const opacity = computeEntryState(ms).floodOpacity;
      expect(opacity).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = opacity;
    }
  });

  it("floodOpacity reaches 1 during the hold and fades to 0 by the end", () => {
    expect(computeEntryState(5500).floodOpacity).toBeCloseTo(1);
    expect(computeEntryState(6100).floodOpacity).toBeCloseTo(1);
    expect(computeEntryState(ENTRY_TOTAL_MS).floodOpacity).toBeCloseTo(0);
  });

  it("reports the phases in order as elapsed time increases", () => {
    const samples = [0, 1000, 3000, 5000, 6500, 7300, 8000];
    const phases = samples.map((ms) => computeEntryState(ms).phase);
    expect(phases).toEqual([
      "idle",
      "accelerating",
      "burst",
      "flood",
      "reveal",
      "done",
      "done",
    ]);
  });

  it("is complete once the total duration has elapsed, not before", () => {
    expect(computeEntryState(ENTRY_TOTAL_MS - 1).isComplete).toBe(false);
    expect(computeEntryState(ENTRY_TOTAL_MS).isComplete).toBe(true);
    expect(computeEntryState(ENTRY_TOTAL_MS + 5000).isComplete).toBe(true);
  });

  it("clamps negative elapsed time to the start state", () => {
    expect(computeEntryState(-500)).toEqual(computeEntryState(0));
  });
});

describe("computeReducedMotionState", () => {
  it("has no speed ramp and no rays at any point", () => {
    for (const ms of [0, 100, 200, 400, 1000]) {
      const state = computeReducedMotionState(ms);
      expect(state.speedMultiplier).toBe(1);
      expect(state.rayIntensity).toBe(0);
      expect(state.luminousAmount).toBe(0);
    }
  });

  it("cross-fades opacity from 0 to 1 over the reduced-motion duration", () => {
    expect(computeReducedMotionState(0).floodOpacity).toBe(0);
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS).floodOpacity).toBeCloseTo(1);
    const mid = computeReducedMotionState(REDUCED_MOTION_TOTAL_MS / 2).floodOpacity;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("is complete once the short duration elapses", () => {
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS - 1).isComplete).toBe(false);
    expect(computeReducedMotionState(REDUCED_MOTION_TOTAL_MS).isComplete).toBe(true);
  });
});
