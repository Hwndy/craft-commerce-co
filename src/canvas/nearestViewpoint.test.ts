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

  // T6 (found in review, Greptile, PR #3): cameraForViewpoint() (viewpoints.ts)
  // centres the landing camera for "about"/"contact" instead of using their
  // raw x/y directly — so the camera the visitor actually lands on no
  // longer sits at "contact"'s own coordinates. Without viewpointCenter()
  // accounting for that same exception here, this would misidentify the
  // nearest viewpoint as "shop-floor" instead, at the exact 1920x1080/
  // (0,2000) numbers from the review comment itself.
  it("still identifies 'contact' as nearest once its camera is centred (not at contact's own raw x/y)", () => {
    const path = [vp("shop-floor", -2000, 1200), vp("contact", 0, 2000)];
    const landedCamera = { x: -960, y: 1460, zoom: 1 }; // cameraForViewpoint(contact, {1920,1080})
    expect(nearestViewpoint(landedCamera, path, 1920, 1080)?.key).toBe("contact");
  });
});
