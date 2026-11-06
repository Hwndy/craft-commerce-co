import { describe, expect, it } from "vitest";

import { computeEntryState, computeReducedMotionState, ENTRY_TOTAL_MS } from "./EntryOrchestrator";

/**
 * WCAG 2.3.1: content must not flash more than three times in any one-second
 * window. A "flash" is a full up-then-down (or down-then-up) cycle, i.e. two
 * direction changes. This samples the real curves at ~60fps and finds the
 * worst 1-second window for direction changes, rather than just asserting
 * monotonicity (which wouldn't catch, say, a sine-pulse regression).
 */
function maxDirectionChangesInAnyWindow(
  samples: number[],
  sampleIntervalMs: number,
  windowMs: number
): number {
  const windowSamples = Math.ceil(windowMs / sampleIntervalMs);
  let worst = 0;

  for (let start = 0; start + windowSamples < samples.length; start++) {
    let changes = 0;
    let lastDirection = 0;
    for (let i = start; i < start + windowSamples; i++) {
      const delta = samples[i + 1] - samples[i];
      const direction = delta > 1e-9 ? 1 : delta < -1e-9 ? -1 : 0;
      if (direction !== 0) {
        if (lastDirection !== 0 && direction !== lastDirection) changes++;
        lastDirection = direction;
      }
    }
    worst = Math.max(worst, changes);
  }
  return worst;
}

function sampleFullMotion(sampleIntervalMs: number) {
  const floodOpacity: number[] = [];
  const rayIntensity: number[] = [];
  const luminousAmount: number[] = [];
  for (let t = 0; t <= ENTRY_TOTAL_MS; t += sampleIntervalMs) {
    const state = computeEntryState(t);
    floodOpacity.push(state.floodOpacity);
    rayIntensity.push(state.rayIntensity);
    luminousAmount.push(state.luminousAmount);
  }
  return { floodOpacity, rayIntensity, luminousAmount };
}

describe("entry sequence photosensitivity (no flashing above 3 Hz)", () => {
  const SAMPLE_MS = 16; // ~60fps, matches the rAF-driven real playback rate
  const WINDOW_MS = 1000;
  // A flash = 2 direction changes; "more than 3 flashes/second" means failing
  // at 6+ direction changes in any 1s window. Each ramped channel below only
  // ever rises then falls once across the whole ~7.3s sequence, so this
  // should pass with a large margin — it's a regression guard, not a
  // near-miss check.
  const MAX_ALLOWED_DIRECTION_CHANGES = 5;

  it("flood overlay never oscillates fast enough to flash", () => {
    const { floodOpacity } = sampleFullMotion(SAMPLE_MS);
    expect(maxDirectionChangesInAnyWindow(floodOpacity, SAMPLE_MS, WINDOW_MS)).toBeLessThanOrEqual(
      MAX_ALLOWED_DIRECTION_CHANGES
    );
  });

  it("rays intensity never oscillates fast enough to flash", () => {
    const { rayIntensity } = sampleFullMotion(SAMPLE_MS);
    expect(maxDirectionChangesInAnyWindow(rayIntensity, SAMPLE_MS, WINDOW_MS)).toBeLessThanOrEqual(
      MAX_ALLOWED_DIRECTION_CHANGES
    );
  });

  it("seal luminous amount never oscillates fast enough to flash", () => {
    const { luminousAmount } = sampleFullMotion(SAMPLE_MS);
    expect(maxDirectionChangesInAnyWindow(luminousAmount, SAMPLE_MS, WINDOW_MS)).toBeLessThanOrEqual(
      MAX_ALLOWED_DIRECTION_CHANGES
    );
  });

  it("reduced-motion cross-fade never oscillates fast enough to flash", () => {
    const floodOpacity: number[] = [];
    for (let t = 0; t <= 400; t += SAMPLE_MS) {
      floodOpacity.push(computeReducedMotionState(t).floodOpacity);
    }
    expect(maxDirectionChangesInAnyWindow(floodOpacity, SAMPLE_MS, WINDOW_MS)).toBeLessThanOrEqual(
      MAX_ALLOWED_DIRECTION_CHANGES
    );
  });
});
