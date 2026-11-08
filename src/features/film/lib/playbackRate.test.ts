import { describe, expect, it } from "vitest";

import { nextPlaybackRate, PLAYBACK_RATES } from "./playbackRate";

describe("nextPlaybackRate", () => {
  it("steps through the cycle in order", () => {
    for (let i = 0; i < PLAYBACK_RATES.length - 1; i++) {
      expect(nextPlaybackRate(PLAYBACK_RATES[i])).toBe(PLAYBACK_RATES[i + 1]);
    }
  });

  it("wraps from the last rate back to the first", () => {
    expect(nextPlaybackRate(PLAYBACK_RATES[PLAYBACK_RATES.length - 1])).toBe(PLAYBACK_RATES[0]);
  });

  it("falls back to the first rate for a value outside the cycle", () => {
    expect(nextPlaybackRate(3)).toBe(PLAYBACK_RATES[0]);
  });
});
