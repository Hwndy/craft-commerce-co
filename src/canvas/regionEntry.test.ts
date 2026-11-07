import { describe, expect, it } from "vitest";

import { hasEnteredRegion, regionCoverageFraction } from "./regionEntry";

describe("regionCoverageFraction", () => {
  it("is 1 when the region exactly fills the viewport", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const region = { x: 0, y: 0, width: 1000, height: 800 };
    expect(regionCoverageFraction(region, camera, 1000, 800)).toBeCloseTo(1);
  });

  it("is 1 when the region covers more than the viewport", () => {
    const camera = { x: 100, y: 100, zoom: 1 };
    const region = { x: -1000, y: -1000, width: 5000, height: 5000 };
    expect(regionCoverageFraction(region, camera, 1000, 800)).toBeCloseTo(1);
  });

  it("is 0 when the region is nowhere near the viewport", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const region = { x: 100000, y: 100000, width: 100, height: 100 };
    expect(regionCoverageFraction(region, camera, 1000, 800)).toBe(0);
  });

  it("is a partial fraction for a region covering half the viewport", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    // Region covers the left half of a 1000x800 viewport.
    const region = { x: 0, y: 0, width: 500, height: 800 };
    expect(regionCoverageFraction(region, camera, 1000, 800)).toBeCloseTo(0.5);
  });

  it("accounts for zoom (region in world units, viewport in screen px)", () => {
    // At zoom 2, the visible world rect is half the viewport's world size.
    const camera = { x: 0, y: 0, zoom: 2 };
    const region = { x: 0, y: 0, width: 500, height: 400 }; // exactly the visible rect at this zoom
    expect(regionCoverageFraction(region, camera, 1000, 800)).toBeCloseTo(1);
  });
});

describe("hasEnteredRegion", () => {
  it("is true at or above the threshold", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const region = { x: 0, y: 0, width: 700, height: 800 }; // 70% of 1000 width
    expect(hasEnteredRegion(region, camera, 1000, 800, 0.7)).toBe(true);
  });

  it("is false below the threshold", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const region = { x: 0, y: 0, width: 600, height: 800 }; // 60% of 1000 width
    expect(hasEnteredRegion(region, camera, 1000, 800, 0.7)).toBe(false);
  });

  it("uses the default 70% threshold when none is given", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const fullyCovering = { x: 0, y: 0, width: 1000, height: 800 };
    const barelyCovering = { x: 0, y: 0, width: 100, height: 800 };
    expect(hasEnteredRegion(fullyCovering, camera, 1000, 800)).toBe(true);
    expect(hasEnteredRegion(barelyCovering, camera, 1000, 800)).toBe(false);
  });
});
