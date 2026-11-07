import { describe, expect, it } from "vitest";

import { photoIdFromSplat } from "./galleryRoute";

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
  });
});
