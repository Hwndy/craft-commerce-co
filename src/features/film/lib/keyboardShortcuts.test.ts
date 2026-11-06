import { describe, expect, it } from "vitest";

import { actionForKey } from "./keyboardShortcuts";

describe("actionForKey", () => {
  it("maps Space and K to toggle-play", () => {
    expect(actionForKey(" ")).toEqual({ type: "toggle-play" });
    expect(actionForKey("k")).toEqual({ type: "toggle-play" });
    expect(actionForKey("K")).toEqual({ type: "toggle-play" });
  });

  it("maps M to toggle-mute", () => {
    expect(actionForKey("m")).toEqual({ type: "toggle-mute" });
    expect(actionForKey("M")).toEqual({ type: "toggle-mute" });
  });

  it("maps Left/Right to a 5 second relative seek", () => {
    expect(actionForKey("ArrowLeft")).toEqual({ type: "seek-relative", deltaSeconds: -5 });
    expect(actionForKey("ArrowRight")).toEqual({ type: "seek-relative", deltaSeconds: 5 });
  });

  it("maps Home/End to seek-to-start/end", () => {
    expect(actionForKey("Home")).toEqual({ type: "seek-to-start" });
    expect(actionForKey("End")).toEqual({ type: "seek-to-end" });
  });

  it("maps digit keys 0-9 to 0%-90% jumps", () => {
    expect(actionForKey("0")).toEqual({ type: "seek-to-percent", percent: 0 });
    expect(actionForKey("5")).toEqual({ type: "seek-to-percent", percent: 50 });
    expect(actionForKey("9")).toEqual({ type: "seek-to-percent", percent: 90 });
  });

  it("returns null for keys with no player shortcut", () => {
    expect(actionForKey("a")).toBeNull();
    expect(actionForKey("Escape")).toBeNull();
    expect(actionForKey("Tab")).toBeNull();
  });
});
