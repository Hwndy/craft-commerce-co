import { describe, expect, it } from "vitest";

import { timeFromDrag } from "./spinDrag";

describe("timeFromDrag", () => {
  const anchor = { startX: 100, startTime: 2 };

  it("no movement leaves the time unchanged", () => {
    expect(timeFromDrag(anchor, 100, 8, 200)).toBe(2);
  });

  it("dragging right moves time backward", () => {
    // deltaX=50 is a quarter of the 200px loop, i.e. 2s of an 8s clip.
    expect(timeFromDrag(anchor, 150, 8, 200)).toBeCloseTo(0, 5);
  });

  it("dragging left moves time forward", () => {
    expect(timeFromDrag(anchor, 50, 8, 200)).toBeCloseTo(4, 5);
  });

  it("wraps past the end of the clip instead of clamping", () => {
    // Dragging left by a full loop's worth of pixels from startTime=2 on
    // an 8s clip should land back near 2s, not stop at 8.
    expect(timeFromDrag(anchor, -100, 8, 200)).toBeCloseTo(2, 5);
  });

  it("wraps past the start of the clip instead of going negative", () => {
    const nearStart = { startX: 100, startTime: 0.5 };
    expect(timeFromDrag(nearStart, 125, 8, 200)).toBeCloseTo(7.5, 5);
  });

  it("a larger pixelsPerLoop makes the same drag distance spin less", () => {
    const short = timeFromDrag(anchor, 150, 8, 200);
    const long = timeFromDrag(anchor, 150, 8, 800);
    expect(Math.abs(2 - long)).toBeLessThan(Math.abs(2 - short));
  });

  it("falls back to the anchor's own time for a zero or unknown duration", () => {
    expect(timeFromDrag(anchor, 300, 0, 200)).toBe(2);
    expect(timeFromDrag(anchor, 300, NaN, 200)).toBe(2);
  });
});
