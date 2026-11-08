import { describe, expect, it } from "vitest";

import { initialViewpointKeyFromSplat, photoIdFromSplat, productSlugFromSplat } from "./galleryRoute";

describe("photoIdFromSplat", () => {
  it("returns null for a plain /gallery visit (empty splat)", () => {
    expect(photoIdFromSplat("")).toBeNull();
    expect(photoIdFromSplat(undefined)).toBeNull();
  });

  it("extracts the id from photo/:id", () => {
    expect(photoIdFromSplat("photo/abc-123")).toBe("abc-123");
  });

  it("returns null for any other splat shape", () => {
    expect(photoIdFromSplat("something-else")).toBeNull();
    expect(photoIdFromSplat("photo")).toBeNull();
    expect(photoIdFromSplat("shop/sample-belt-no-5")).toBeNull();
  });
});

describe("productSlugFromSplat", () => {
  it("returns null for a plain /gallery visit (empty splat)", () => {
    expect(productSlugFromSplat("")).toBeNull();
    expect(productSlugFromSplat(undefined)).toBeNull();
  });

  it("extracts the slug from shop/:slug", () => {
    expect(productSlugFromSplat("shop/sample-belt-no-5")).toBe("sample-belt-no-5");
  });

  it("returns null for any other splat shape", () => {
    expect(productSlugFromSplat("something-else")).toBeNull();
    expect(productSlugFromSplat("shop")).toBeNull();
    expect(productSlugFromSplat("photo/abc-123")).toBeNull();
  });
});

describe("initialViewpointKeyFromSplat", () => {
  it("returns null for a plain /gallery visit (empty splat)", () => {
    expect(initialViewpointKeyFromSplat("")).toBeNull();
    expect(initialViewpointKeyFromSplat(undefined)).toBeNull();
  });

  it("recognises the bare 'about'/'contact' splats (T6)", () => {
    expect(initialViewpointKeyFromSplat("about")).toBe("about");
    expect(initialViewpointKeyFromSplat("contact")).toBe("contact");
  });

  it("returns null for any other splat shape, including photo/shop tails", () => {
    expect(initialViewpointKeyFromSplat("something-else")).toBeNull();
    expect(initialViewpointKeyFromSplat("photo/abc-123")).toBeNull();
    expect(initialViewpointKeyFromSplat("shop/sample-belt-no-5")).toBeNull();
  });
});
