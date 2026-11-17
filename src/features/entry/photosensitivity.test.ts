import { describe, expect, it } from "vitest";

import { computeReducedMotionState } from "./EntryOrchestrator";

/**
 * WCAG 2.3.1: content must not flash more than three times in any one-second
 * window. A "flash" is a full up-then-down (or down-then-up) cycle, i.e. two
 * direction changes. This samples the real curve at ~60fps and finds the
 * worst 1-second window for direction changes, rather than just asserting
 * monotonicity (which wouldn't catch, say, a sine-pulse regression).
 *
 * The full-motion case used to have its own curves here too (flood/rays/
 * luminous), sampled the same way — gone along with `computeEntryState`
 * now that the owner's real transition video (docs/decisions.md) plays
 * once, as filmed, instead of a CSS-driven ramp. That footage was checked
 * frame-by-frame by hand before this swap: one smooth, monotonic
 * brightening over ~7s, not a repeated flash (noted in the PR, since there's
 * no curve left here to assert it against). Reduced motion still computes
 * its own cross-fade, so it still needs this guard.
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

describe("entry sequence photosensitivity (no flashing above 3 Hz)", () => {
  const SAMPLE_MS = 16; // ~60fps, matches the rAF-driven real playback rate
  const WINDOW_MS = 1000;
  // A flash = 2 direction changes; "more than 3 flashes/second" means failing
  // at 6+ direction changes in any 1s window. The cross-fade only ever rises
  // once across its whole 400ms, so this should pass with a large margin —
  // it's a regression guard, not a near-miss check.
  const MAX_ALLOWED_DIRECTION_CHANGES = 5;

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
