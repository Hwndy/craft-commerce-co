import { describe, expect, it } from "vitest";

import { clampGuidedIndex, guidedPathViewpoints, nearestGuidedIndex } from "./guidedPath";
import type { Viewpoint } from "./types";

function vp(key: string, sortOrder: number, inGuidedPath = true, x = 0, y = 0, zoom = 1): Viewpoint {
  return { key, label: key, x, y, zoom, sortOrder, inGuidedPath };
}

describe("guidedPathViewpoints", () => {
  it("filters to only inGuidedPath viewpoints, sorted by sortOrder", () => {
    const viewpoints = [vp("c", 2), vp("a", 0), vp("excluded", 1, false), vp("b", 1)];
    expect(guidedPathViewpoints(viewpoints).map((v) => v.key)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const viewpoints = [vp("b", 1), vp("a", 0)];
    const original = [...viewpoints];
    guidedPathViewpoints(viewpoints);
    expect(viewpoints).toEqual(original);
  });
});

describe("clampGuidedIndex", () => {
  it("clamps within [0, length-1]", () => {
    expect(clampGuidedIndex(-5, 4)).toBe(0);
    expect(clampGuidedIndex(2, 4)).toBe(2);
    expect(clampGuidedIndex(99, 4)).toBe(3);
  });

  it("returns 0 for an empty path", () => {
    expect(clampGuidedIndex(5, 0)).toBe(0);
  });
});

describe("nearestGuidedIndex", () => {
  const path = [vp("a", 0, true, 0, 0), vp("b", 1, true, 2000, 0), vp("c", 2, true, 4000, 0)];

  it("picks the exact match when the camera sits on a path viewpoint", () => {
    expect(nearestGuidedIndex({ x: 2000, y: 0, zoom: 1 }, path, 1000, 800)).toBe(1);
  });

  it("picks the closest viewpoint for an in-between camera position", () => {
    expect(nearestGuidedIndex({ x: 2900, y: 0, zoom: 1 }, path, 1000, 800)).toBe(1);
    expect(nearestGuidedIndex({ x: 3100, y: 0, zoom: 1 }, path, 1000, 800)).toBe(2);
  });

  it("returns 0 for an empty path", () => {
    expect(nearestGuidedIndex({ x: 0, y: 0, zoom: 1 }, [], 1000, 800)).toBe(0);
  });

  // T6 (found in review, Greptile, PR #3): same fix as nearestViewpoint.ts's
  // own regression test — switching Explore → Guided while actually
  // looking at Contact must resolve back to Contact's own path index, not
  // whichever region happens to sit nearest its *raw, uncentred*
  // coordinates.
  it("still resolves to 'contact's index once its camera is centred (not at contact's own raw x/y)", () => {
    const centredPath = [vp("shop-floor", 0, true, -2000, 1200), vp("contact", 1, true, 0, 2000)];
    const landedCamera = { x: -960, y: 1460, zoom: 1 }; // cameraForViewpoint(contact, {1920,1080})
    expect(nearestGuidedIndex(landedCamera, centredPath, 1920, 1080)).toBe(1);
  });
});
