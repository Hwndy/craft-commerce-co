import { describe, expect, it } from "vitest";

import { cellsForRect, cullingRect, cullNodes, expandRect, rectsIntersect } from "./culling";
import type { CanvasNode } from "./types";

function node(id: string, x: number, y: number, width = 100, height = 100): CanvasNode {
  return { id, region: "test", type: "image", x, y, width, height, rotation: 0, layer: 0, zoomMin: 0, zoomMax: 100 };
}

describe("expandRect", () => {
  it("grows the rect by the given fraction on each side", () => {
    const rect = { x: 0, y: 0, width: 100, height: 200 };
    const expanded = expandRect(rect, 0.25);
    expect(expanded).toEqual({ x: -25, y: -50, width: 150, height: 300 });
  });

  it("is a no-op at fraction 0", () => {
    const rect = { x: 10, y: 20, width: 100, height: 100 };
    expect(expandRect(rect, 0)).toEqual(rect);
  });
});

describe("rectsIntersect", () => {
  it("detects overlap", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it("detects no overlap", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 20, width: 10, height: 10 })).toBe(
      false
    );
  });

  it("touching edges do not count as intersecting", () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(
      false
    );
  });
});

describe("cellsForRect", () => {
  it("returns a single cell for a rect within one cell", () => {
    expect(cellsForRect({ x: 10, y: 10, width: 5, height: 5 }, 1000)).toEqual([{ col: 0, row: 0 }]);
  });

  it("spans multiple cells for a rect crossing a boundary", () => {
    const cells = cellsForRect({ x: 900, y: 0, width: 200, height: 10 }, 1000);
    const cols = cells.map((c) => c.col).sort();
    expect(cols).toEqual([0, 1]);
  });

  it("returns no cells for a degenerate rect", () => {
    expect(cellsForRect({ x: 0, y: 0, width: 0, height: 100 }, 1000)).toEqual([]);
  });
});

describe("cullingRect", () => {
  it("expands the visible rect by the margin fraction", () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const rect = cullingRect(camera, 1000, 800, 0.25);
    // visible is {x:0,y:0,width:1000,height:800}; margin 25% each side.
    expect(rect).toEqual({ x: -250, y: -200, width: 1500, height: 1200 });
  });
});

describe("cullNodes", () => {
  const camera = { x: 0, y: 0, zoom: 1 };
  const vw = 1000;
  const vh = 800;

  it("keeps nodes inside the viewport", () => {
    const nodes = [node("a", 100, 100)];
    expect(cullNodes(nodes, camera, vw, vh).map((n) => n.id)).toEqual(["a"]);
  });

  it("keeps nodes just outside the viewport but within the margin", () => {
    // Visible rect right edge is x=1000; a node starting at 1050 is within
    // the 25%-of-1000=250 margin.
    const nodes = [node("a", 1050, 100)];
    expect(cullNodes(nodes, camera, vw, vh, 0.25).map((n) => n.id)).toEqual(["a"]);
  });

  it("drops nodes well outside the viewport and its margin", () => {
    const nodes = [node("a", 10000, 10000)];
    expect(cullNodes(nodes, camera, vw, vh).map((n) => n.id)).toEqual([]);
  });

  it("filters a mixed list, preserving order", () => {
    const nodes = [node("near", 0, 0), node("far", 50000, 50000), node("also-near", 500, 500)];
    expect(cullNodes(nodes, camera, vw, vh).map((n) => n.id)).toEqual(["near", "also-near"]);
  });
});
