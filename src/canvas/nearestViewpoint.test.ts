import { describe, expect, it } from "vitest";

import { nearestViewpoint } from "./nearestViewpoint";
import type { Viewpoint } from "./types";

function vp(key: string, x: number, y: number): Viewpoint {
  return { key, label: key, x, y, zoom: 1, sortOrder: 0, inGuidedPath: true };
}

describe("nearestViewpoint", () => {
  const viewpoints = [vp("landing", 0, 0), vp("gallery", 2000, 0), vp("shop", -2000, 0)];

  it("returns the exact match when the camera sits on a viewpoint", () => {
    expect(nearestViewpoint({ x: 2000, y: 0, zoom: 1 }, viewpoints, 1000, 800)?.key).toBe("gallery");
  });

  it("returns the closest viewpoint for an in-between position", () => {
    expect(nearestViewpoint({ x: 900, y: 0, zoom: 1 }, viewpoints, 1000, 800)?.key).toBe("landing");
    expect(nearestViewpoint({ x: 1100, y: 0, zoom: 1 }, viewpoints, 1000, 800)?.key).toBe("gallery");
  });

  it("returns null for an empty list", () => {
    expect(nearestViewpoint({ x: 0, y: 0, zoom: 1 }, [], 1000, 800)).toBeNull();
  });
});
