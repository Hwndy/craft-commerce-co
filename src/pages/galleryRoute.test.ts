import { describe, expect, it } from "vitest";

import { photoIdFromSplat, productSlugFromSplat } from "./galleryRoute";

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
