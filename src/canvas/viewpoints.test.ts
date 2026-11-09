import { afterEach, describe, expect, it } from "vitest";

import { cameraForViewpoint, clearViewpointsCache, getViewpoint, listViewpoints, setViewpointsCache } from "./viewpoints";

describe("viewpoints", () => {
  afterEach(() => {
    clearViewpointsCache();
  });

  it("falls back to the static landing/gallery/collage/shop-wall/shop-floor/about/contact registry before the cache is populated", () => {
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
    expect(getViewpoint("about")).toEqual({
      key: "about",
      label: "About",
      x: 0,
      y: -2000,
      zoom: 1,
      sortOrder: 5,
      inGuidedPath: true,
    });
    expect(getViewpoint("contact").y).toBe(2000);
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
      "about",
      "contact",
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
      "about",
      "contact",
    ]);
  });
});

describe("cameraForViewpoint", () => {
  afterEach(() => {
    clearViewpointsCache();
  });

  const viewport = { width: 1000, height: 800 };

  it("returns the raw viewpoint unchanged for every region except about/contact/shop-wall/shop-floor", () => {
    for (const key of ["landing", "gallery", "collage"]) {
      const viewpoint = getViewpoint(key);
      expect(cameraForViewpoint(viewpoint, viewport)).toEqual(viewpoint);
    }
  });

  // T6 (found in review, Greptile/CodeRabbit, PR #3): About/Contact's own
  // Region placement treats the viewpoint's x/y as the panel's *centre*,
  // unlike Gallery/Collage — this is the one place that distinction is
  // resolved, so every flyTo/setCamera call site shares it. Shop's two
  // regions (T2) joined this set afterwards (found by the owner, docs/
  // decisions.md D-60): each is seeded with exactly one small product card
  // deliberately centred on the region's own viewpoint coordinate, so the
  // same raw-top-left landing cropped roughly half of it on arrival.
  it("centres the camera on about/contact/shop-wall/shop-floor's viewpoint instead of using it as the raw top-left", () => {
    for (const key of ["about", "contact", "shop-wall", "shop-floor"]) {
      const viewpoint = getViewpoint(key);
      const camera = cameraForViewpoint(viewpoint, viewport);
      expect(camera).not.toEqual(viewpoint);
      expect(camera.zoom).toBe(viewpoint.zoom);
      // The viewport's centre, in world space, should land exactly on the
      // viewpoint's own x/y — i.e. camera.x/y + half the viewport.
      expect(camera.x + viewport.width / (2 * camera.zoom)).toBeCloseTo(viewpoint.x);
      expect(camera.y + viewport.height / (2 * camera.zoom)).toBeCloseTo(viewpoint.y);
    }
  });
});
