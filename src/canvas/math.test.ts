import { describe, expect, it } from "vitest";
import {
  cameraCenter,
  cameraFromCenter,
  clamp,
  clamp01,
  clampPanToBounds,
  clampZoom,
  easeInOutCubic,
  exponentialDecay,
  fitRectToViewport,
  flightDurationMs,
  interpolateCamera,
  intersectionArea,
  lerp,
  screenToWorld,
  visibleWorldRect,
  worldToScreen,
  zoomAboutPoint,
} from "./math";

describe("clamp / clamp01 / lerp", () => {
  it("clamp bounds a value", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("clamp01 bounds to [0, 1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
  });

  it("lerp interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe("clampZoom", () => {
  it("clamps to the default limits", () => {
    expect(clampZoom(0.01)).toBeCloseTo(0.15);
    expect(clampZoom(100)).toBeCloseTo(6);
    expect(clampZoom(1)).toBeCloseTo(1);
  });

  it("respects custom limits", () => {
    expect(clampZoom(50, { min: 1, max: 10 })).toBe(10);
  });
});

describe("easeInOutCubic", () => {
  it("maps the boundaries and midpoint", () => {
    expect(easeInOutCubic(0)).toBeCloseTo(0);
    expect(easeInOutCubic(1)).toBeCloseTo(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
  });

  it("is monotonically non-decreasing", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeInOutCubic(t);
      expect(value).toBeGreaterThanOrEqual(prev);
      prev = value;
    }
  });
});

describe("screenToWorld / worldToScreen", () => {
  const cam = { x: 100, y: -50, zoom: 2 };

  it("round-trips a point", () => {
    const world = screenToWorld(cam, 40, 60);
    const screen = worldToScreen(cam, world.x, world.y);
    expect(screen.x).toBeCloseTo(40);
    expect(screen.y).toBeCloseTo(60);
  });

  it("maps the top-left of the viewport to cam.x, cam.y", () => {
    expect(screenToWorld(cam, 0, 0)).toEqual({ x: 100, y: -50 });
  });

  it("scales by zoom", () => {
    const world = screenToWorld({ x: 0, y: 0, zoom: 4 }, 40, 40);
    expect(world).toEqual({ x: 10, y: 10 });
  });
});

describe("zoomAboutPoint", () => {
  it("keeps the world point under the screen point fixed", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const before = screenToWorld(cam, 200, 150);
    const next = zoomAboutPoint(cam, 200, 150, 3);
    const after = screenToWorld(next, 200, 150);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBeCloseTo(3);
  });

  it("clamps the resulting zoom", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    const next = zoomAboutPoint(cam, 0, 0, 999);
    expect(next.zoom).toBeCloseTo(6);
  });
});

describe("fitRectToViewport", () => {
  it("fits a rectangle with the given padding", () => {
    const rect = { x: 0, y: 0, width: 1000, height: 500 };
    const cam = fitRectToViewport(rect, 2000, 2000, 0.9);
    // width is the limiting dimension: zoom = min(2000/1000, 2000/500) * 0.9 = 1.8
    expect(cam.zoom).toBeCloseTo(1.8);
    const visible = visibleWorldRect(cam, 2000, 2000);
    // the rect's centre should be the visible rect's centre too
    expect(visible.x + visible.width / 2).toBeCloseTo(500);
    expect(visible.y + visible.height / 2).toBeCloseTo(250);
  });

  it("clamps zoom to the configured limits", () => {
    const tiny = { x: 0, y: 0, width: 1, height: 1 };
    const cam = fitRectToViewport(tiny, 2000, 2000);
    expect(cam.zoom).toBeLessThanOrEqual(6);
  });
});

describe("visibleWorldRect", () => {
  it("derives the rect from camera position, viewport size and zoom", () => {
    const rect = visibleWorldRect({ x: 10, y: 20, zoom: 2 }, 400, 200);
    expect(rect).toEqual({ x: 10, y: 20, width: 200, height: 100 });
  });
});

describe("cameraCenter / cameraFromCenter", () => {
  it("round-trips a camera through its centre", () => {
    const cam = { x: 10, y: 20, zoom: 2 };
    const center = cameraCenter(cam, 400, 300);
    const rebuilt = cameraFromCenter(center, cam.zoom, 400, 300);
    expect(rebuilt.x).toBeCloseTo(cam.x);
    expect(rebuilt.y).toBeCloseTo(cam.y);
  });
});

describe("interpolateCamera", () => {
  const a = { x: 0, y: 0, zoom: 1 };
  const b = { x: 1000, y: 500, zoom: 4 };

  it("returns camera a at t=0 and camera b at t=1", () => {
    const atStart = interpolateCamera(a, b, 0, 800, 600);
    expect(atStart.x).toBeCloseTo(a.x);
    expect(atStart.y).toBeCloseTo(a.y);
    expect(atStart.zoom).toBeCloseTo(a.zoom);

    const atEnd = interpolateCamera(a, b, 1, 800, 600);
    expect(atEnd.x).toBeCloseTo(b.x);
    expect(atEnd.y).toBeCloseTo(b.y);
    expect(atEnd.zoom).toBeCloseTo(b.zoom);
  });

  it("interpolates zoom in log space (midpoint is the geometric mean)", () => {
    const mid = interpolateCamera(a, b, 0.5, 800, 600);
    expect(mid.zoom).toBeCloseTo(Math.sqrt(a.zoom * b.zoom));
  });

  it("keeps the viewport centre moving monotonically toward b", () => {
    let prevDist = Infinity;
    for (let t = 0; t <= 1; t += 0.1) {
      const cam = interpolateCamera(a, b, t, 800, 600);
      const center = cameraCenter(cam, 800, 600);
      const centerB = cameraCenter(b, 800, 600);
      const dist = Math.hypot(center.x - centerB.x, center.y - centerB.y);
      expect(dist).toBeLessThanOrEqual(prevDist + 1e-6);
      prevDist = dist;
    }
  });
});

describe("exponentialDecay", () => {
  it("halves the value after one half-life", () => {
    expect(exponentialDecay(100, 0.25, 0.25)).toBeCloseTo(50);
  });

  it("is unchanged at dt=0", () => {
    expect(exponentialDecay(100, 0, 0.25)).toBeCloseTo(100);
  });

  it("approaches zero as dt grows, never overshooting or flipping sign", () => {
    let prev = 100;
    for (let dt = 0; dt <= 2; dt += 0.1) {
      const value = exponentialDecay(100, dt, 0.25);
      expect(value).toBeLessThanOrEqual(prev + 1e-9);
      expect(value).toBeGreaterThanOrEqual(0);
      prev = value;
    }
    expect(exponentialDecay(100, 2, 0.25)).toBeLessThan(1);
  });

  it("preserves sign for a negative value", () => {
    expect(exponentialDecay(-100, 0.25, 0.25)).toBeCloseTo(-50);
  });

  it("returns 0 for a non-positive half-life", () => {
    expect(exponentialDecay(100, 0.1, 0)).toBe(0);
    expect(exponentialDecay(100, 0.1, -1)).toBe(0);
  });
});

describe("clampPanToBounds", () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };

  it("does not move a camera already well inside the bounds", () => {
    const cam = { x: 400, y: 400, zoom: 1 };
    const next = clampPanToBounds(cam, bounds, 200, 200);
    expect(next.x).toBeCloseTo(cam.x);
    expect(next.y).toBeCloseTo(cam.y);
  });

  it("pulls the camera back so some of the bounds stays visible", () => {
    // Visible rect at zoom 1, 200x200 viewport, camera way off to the right —
    // with no overlap with bounds at all.
    const cam = { x: 5000, y: 5000, zoom: 1 };
    const next = clampPanToBounds(cam, bounds, 200, 200, 0.1);
    const visible = visibleWorldRect(next, 200, 200);
    const overlapsX = visible.x < bounds.x + bounds.width && visible.x + visible.width > bounds.x;
    const overlapsY = visible.y < bounds.y + bounds.height && visible.y + visible.height > bounds.y;
    expect(overlapsX).toBe(true);
    expect(overlapsY).toBe(true);
  });

  it("leaves zoom untouched", () => {
    const cam = { x: 5000, y: 5000, zoom: 2.5 };
    const next = clampPanToBounds(cam, bounds, 200, 200);
    expect(next.zoom).toBe(2.5);
  });
});

describe("intersectionArea", () => {
  it("is the full area of either rect when one fully contains the other", () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 };
    const inner = { x: 10, y: 10, width: 20, height: 20 };
    expect(intersectionArea(outer, inner)).toBeCloseTo(400);
  });

  it("is 0 when the rects don't overlap", () => {
    expect(intersectionArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 100, y: 100, width: 10, height: 10 })).toBe(
      0
    );
  });

  it("is 0 for merely touching edges", () => {
    expect(intersectionArea({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(0);
  });

  it("computes a partial overlap", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    // overlap is the 5x5 square from (5,5) to (10,10)
    expect(intersectionArea(a, b)).toBeCloseTo(25);
  });

  it("is symmetric", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(intersectionArea(a, b)).toBeCloseTo(intersectionArea(b, a));
  });
});

describe("flightDurationMs", () => {
  const vw = 1000;
  const vh = 800;

  it("returns the minimum duration for zero distance", () => {
    const cam = { x: 0, y: 0, zoom: 1 };
    expect(flightDurationMs(cam, cam, vw, vh)).toBeCloseTo(900);
  });

  it("clamps to the maximum duration for very large distances", () => {
    const a = { x: 0, y: 0, zoom: 1 };
    const b = { x: 1_000_000, y: 1_000_000, zoom: 1 };
    expect(flightDurationMs(a, b, vw, vh)).toBeCloseTo(2200);
  });

  it("is monotonically non-decreasing with distance", () => {
    const a = { x: 0, y: 0, zoom: 1 };
    let prev = -Infinity;
    for (const dx of [0, 500, 1000, 2000, 5000, 10000]) {
      const duration = flightDurationMs(a, { x: dx, y: 0, zoom: 1 }, vw, vh);
      expect(duration).toBeGreaterThanOrEqual(prev);
      prev = duration;
    }
  });

  it("stays within the configured range", () => {
    const a = { x: 0, y: 0, zoom: 1 };
    const b = { x: 300, y: 0, zoom: 1 };
    const duration = flightDurationMs(a, b, vw, vh);
    expect(duration).toBeGreaterThanOrEqual(900);
    expect(duration).toBeLessThanOrEqual(2200);
  });
});
