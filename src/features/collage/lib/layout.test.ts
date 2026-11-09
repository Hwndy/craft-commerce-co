import { describe, expect, it } from "vitest";

import { rectsIntersect } from "@/canvas/culling";

import {
  collageBoundingBox,
  DEFAULT_ITEMS_PER_STACK,
  DEFAULT_TILT_RANGE_DEG,
  layoutCollage,
  phyllotaxisLayout,
  stripsLayout,
} from "./layout";

function photos(count: number, aspectRatio = 1) {
  return Array.from({ length: count }, (_, i) => ({ id: `photo-${i}`, aspectRatio }));
}

function distance(x: number, y: number, cx: number, cy: number) {
  return Math.hypot(x - cx, y - cy);
}

describe("phyllotaxisLayout", () => {
  it("is deterministic: same ids, same order, same output", () => {
    const first = phyllotaxisLayout(photos(12));
    const second = phyllotaxisLayout(photos(12));
    expect(second).toEqual(first);
  });

  it("places photos at strictly increasing distance from the centre", () => {
    const layouts = phyllotaxisLayout(photos(10), { centerX: 500, centerY: 500 });
    const centers = layouts.map((l) => ({ x: l.x + l.width / 2, y: l.y + l.height / 2 }));
    const distances = centers.map((c) => distance(c.x, c.y, 500, 500));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
  });

  it("keeps tilt within the configured range", () => {
    const layouts = phyllotaxisLayout(photos(30), { tiltRangeDeg: DEFAULT_TILT_RANGE_DEG });
    for (const layout of layouts) {
      expect(layout.rotation).toBeGreaterThanOrEqual(-DEFAULT_TILT_RANGE_DEG);
      expect(layout.rotation).toBeLessThanOrEqual(DEFAULT_TILT_RANGE_DEG);
    }
  });

  it("applies only small size variation around baseSize", () => {
    const baseSize = 200;
    const sizeJitter = 0.12;
    const layouts = phyllotaxisLayout(photos(20, 1), { baseSize, sizeJitter });
    for (const layout of layouts) {
      // aspectRatio 1 -> width === height === longEdge
      expect(layout.width).toBeGreaterThanOrEqual(baseSize * (1 - sizeJitter) - 0.001);
      expect(layout.width).toBeLessThanOrEqual(baseSize * (1 + sizeJitter) + 0.001);
      expect(layout.height).toBeCloseTo(layout.width, 5);
    }
  });

  it("respects aspect ratio: landscape is wider than tall, portrait the reverse", () => {
    const [landscape] = phyllotaxisLayout([{ id: "a", aspectRatio: 2 }]);
    expect(landscape.width).toBeGreaterThan(landscape.height);

    const [portrait] = phyllotaxisLayout([{ id: "a", aspectRatio: 0.5 }]);
    expect(portrait.height).toBeGreaterThan(portrait.width);
  });

  it("gives different ids different jitter in general", () => {
    const layouts = phyllotaxisLayout(photos(8));
    const rotations = new Set(layouts.map((l) => l.rotation));
    expect(rotations.size).toBeGreaterThan(1);
  });

  it("keeps photos from visually overlapping, even across many ids' real size jitter", () => {
    // Regression test: an earlier DEFAULT_RADIUS_STEP (60) packed the first
    // few photos so close together near the spiral's centre that they
    // visually overlapped and the rearmost ones became unclickable — found
    // via a real e2e click failure (mobile-chrome), not by inspection.
    // Sampling 40 real ids (not a forced worst case) exercises the actual
    // deterministic jitter distribution.
    const layouts = phyllotaxisLayout(photos(40));
    for (let i = 0; i < layouts.length; i++) {
      for (let j = i + 1; j < layouts.length; j++) {
        expect(rectsIntersect(layouts[i], layouts[j])).toBe(false);
      }
    }
  });
});

describe("stripsLayout", () => {
  it("is deterministic: same ids, same order, same output", () => {
    const first = stripsLayout(photos(12));
    const second = stripsLayout(photos(12));
    expect(second).toEqual(first);
  });

  // The owner's own sketch ("IDEA 1 for PICTURE LAYOUT", docs/decisions.md
  // D-62): consecutive photos within a stack overlap into a fanned-deck
  // look, not an evenly-spaced grid — the opposite of phyllotaxisLayout's
  // own no-overlap guarantee above.
  it("overlaps consecutive photos within the same stack", () => {
    const layouts = stripsLayout(photos(DEFAULT_ITEMS_PER_STACK));
    for (let i = 1; i < layouts.length; i++) {
      expect(rectsIntersect(layouts[i - 1], layouts[i])).toBe(true);
    }
  });

  it("advances diagonally (both x and y increase) within a stack", () => {
    // Compares centres, not raw left/top edges: per-card size jitter means
    // a wider card's own left edge can sit further left even while its
    // centre still advances along the stack's cascade (same reasoning as
    // phyllotaxisLayout's own centre-based distance test above).
    const layouts = stripsLayout(photos(DEFAULT_ITEMS_PER_STACK));
    const centers = layouts.map((l) => ({ x: l.x + l.width / 2, y: l.y + l.height / 2 }));
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i].x).toBeGreaterThan(centers[i - 1].x);
      expect(centers[i].y).toBeGreaterThan(centers[i - 1].y);
    }
  });

  it("starts a new, non-overlapping stack once itemsPerStack is reached", () => {
    const layouts = stripsLayout(photos(DEFAULT_ITEMS_PER_STACK * 2), { centerX: 0, centerY: 0 });
    const firstStack = layouts.slice(0, DEFAULT_ITEMS_PER_STACK);
    const secondStack = layouts.slice(DEFAULT_ITEMS_PER_STACK);

    // The second stack starts back at the first card's own (small) offset,
    // not continuing the first stack's cascade — i.e. a real new pile, not
    // just one long diagonal line of every photo.
    expect(secondStack[0].y).toBeLessThan(firstStack[firstStack.length - 1].y);

    // And the two stacks' footprints don't reach each other.
    for (const a of firstStack) {
      for (const b of secondStack) {
        expect(rectsIntersect(a, b)).toBe(false);
      }
    }
  });
});

describe("layoutCollage", () => {
  it("defaults to the circular (phyllotaxis) layout", () => {
    expect(layoutCollage(photos(5))).toEqual(phyllotaxisLayout(photos(5)));
  });

  it("uses the strips layout when mode is 'strips'", () => {
    expect(layoutCollage(photos(5), { mode: "strips" })).toEqual(stripsLayout(photos(5)));
  });
});

describe("collageBoundingBox", () => {
  it("returns a zero-size rect for an empty layout", () => {
    expect(collageBoundingBox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("computes the min/max extent across all nodes", () => {
    const rect = collageBoundingBox([
      { id: "a", x: 0, y: 0, width: 100, height: 50, rotation: 0 },
      { id: "b", x: -50, y: 20, width: 100, height: 100, rotation: 0 },
      { id: "c", x: 200, y: -10, width: 10, height: 10, rotation: 0 },
    ]);
    expect(rect).toEqual({ x: -50, y: -10, width: 260, height: 130 });
  });
});
