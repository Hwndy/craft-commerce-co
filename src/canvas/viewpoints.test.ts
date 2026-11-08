import { afterEach, describe, expect, it } from "vitest";

import { clearViewpointsCache, getViewpoint, listViewpoints, setViewpointsCache } from "./viewpoints";

describe("viewpoints", () => {
  afterEach(() => {
    clearViewpointsCache();
  });

  it("falls back to the static landing/gallery/collage/shop-wall/shop-floor registry before the cache is populated", () => {
    expect(getViewpoint("landing")).toEqual({
      key: "landing",
      label: "Landing",
      x: 0,
      y: 0,
      zoom: 1,
      sortOrder: 0,
      inGuidedPath: true,
    });
    expect(getViewpoint("gallery").x).toBe(2000);
    expect(getViewpoint("collage")).toEqual({
      key: "collage",
      label: "Collage",
      x: 2000,
      y: 1200,
      zoom: 1,
      sortOrder: 2,
      inGuidedPath: true,
    });
    expect(getViewpoint("shop-wall")).toEqual({
      key: "shop-wall",
      label: "Shop (wall)",
      x: -2000,
      y: 0,
      zoom: 1,
      sortOrder: 3,
      inGuidedPath: true,
    });
    expect(getViewpoint("shop-floor").y).toBe(1200);
  });

  it("throws for an unknown key in the fallback registry", () => {
    expect(() => getViewpoint("shop")).toThrow(/Unknown viewpoint/);
  });

  it("listViewpoints returns the fallback registry sorted by sortOrder", () => {
    expect(listViewpoints().map((v) => v.key)).toEqual([
      "landing",
      "gallery",
      "collage",
      "shop-wall",
      "shop-floor",
    ]);
  });

  it("setViewpointsCache replaces the data source entirely", () => {
    setViewpointsCache([
      { key: "landing", label: "Landing (db)", x: 0, y: 0, zoom: 1, sortOrder: 0, inGuidedPath: true },
      { key: "shop", label: "Shop", x: -2000, y: 0, zoom: 1, sortOrder: 3, inGuidedPath: true },
    ]);

    expect(getViewpoint("landing").label).toBe("Landing (db)");
    expect(getViewpoint("shop").x).toBe(-2000);
    // gallery was in the static registry but is NOT in this cache payload —
    // the cache fully replaces the fallback, it doesn't merge with it.
    expect(() => getViewpoint("gallery")).toThrow(/Unknown viewpoint/);
  });

  it("listViewpoints sorts the cached data by sortOrder", () => {
    setViewpointsCache([
      { key: "b", label: "B", x: 0, y: 0, zoom: 1, sortOrder: 2, inGuidedPath: true },
      { key: "a", label: "A", x: 0, y: 0, zoom: 1, sortOrder: 1, inGuidedPath: true },
    ]);
    expect(listViewpoints().map((v) => v.key)).toEqual(["a", "b"]);
  });

  it("clearViewpointsCache reverts to the fallback registry", () => {
    setViewpointsCache([{ key: "only", label: "Only", x: 0, y: 0, zoom: 1, sortOrder: 0, inGuidedPath: true }]);
    clearViewpointsCache();
    expect(listViewpoints().map((v) => v.key)).toEqual([
      "landing",
      "gallery",
      "collage",
      "shop-wall",
      "shop-floor",
    ]);
  });
});
