import { describe, expect, it } from "vitest";

import { cyclePhotoId, renditionForScreenWidth, VIEWER_WIDE_SCREEN_PX } from "./viewerNavigation";

describe("renditionForScreenWidth", () => {
  it("uses 1280 below the wide-screen threshold", () => {
    expect(renditionForScreenWidth(VIEWER_WIDE_SCREEN_PX - 1)).toBe("1280");
    expect(renditionForScreenWidth(390)).toBe("1280");
  });

  it("uses 2048 at and above the wide-screen threshold", () => {
    expect(renditionForScreenWidth(VIEWER_WIDE_SCREEN_PX)).toBe("2048");
    expect(renditionForScreenWidth(2560)).toBe("2048");
  });
});

describe("cyclePhotoId", () => {
  const ids = ["a", "b", "c"];

  it("steps forward", () => {
    expect(cyclePhotoId(ids, "a", 1)).toBe("b");
    expect(cyclePhotoId(ids, "b", 1)).toBe("c");
  });

  it("loops from the last photo to the first", () => {
    expect(cyclePhotoId(ids, "c", 1)).toBe("a");
  });

  it("loops from the first photo to the last when stepping backward", () => {
    expect(cyclePhotoId(ids, "a", -1)).toBe("c");
  });

  it("steps backward", () => {
    expect(cyclePhotoId(ids, "c", -1)).toBe("b");
  });

  it("returns the only id for a single-photo set, either direction", () => {
    expect(cyclePhotoId(["only"], "only", 1)).toBe("only");
    expect(cyclePhotoId(["only"], "only", -1)).toBe("only");
  });

  it("returns null for an empty list or an id that isn't present", () => {
    expect(cyclePhotoId([], "a", 1)).toBeNull();
    expect(cyclePhotoId(ids, "missing", 1)).toBeNull();
  });
});
