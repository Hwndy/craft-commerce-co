import { describe, expect, it } from "vitest";

import { isDebugOverlayEnabled } from "./DebugOverlay";

describe("isDebugOverlayEnabled", () => {
  it("is true when ?debug=1 is present", () => {
    expect(isDebugOverlayEnabled("?debug=1")).toBe(true);
  });

  it("is false with no query string", () => {
    expect(isDebugOverlayEnabled("")).toBe(false);
  });

  it("is false for any other value", () => {
    expect(isDebugOverlayEnabled("?debug=true")).toBe(false);
    expect(isDebugOverlayEnabled("?debug=0")).toBe(false);
  });

  it("works alongside other query params", () => {
    expect(isDebugOverlayEnabled("?foo=bar&debug=1")).toBe(true);
  });
});
