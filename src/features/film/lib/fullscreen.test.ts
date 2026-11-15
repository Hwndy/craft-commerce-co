import { afterEach, describe, expect, it, vi } from "vitest";

import { exitFullscreenIfActive, isFullscreenSupported, requestFullscreen } from "./fullscreen";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
  Object.defineProperty(screen, "orientation", { value: undefined, configurable: true });
});

describe("isFullscreenSupported", () => {
  it("reflects document.fullscreenEnabled", () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    expect(isFullscreenSupported()).toBe(true);

    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
    expect(isFullscreenSupported()).toBe(false);
  });
});

describe("requestFullscreen", () => {
  it("does nothing when the browser doesn't support it (e.g. iPhone Safari)", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
    const el = document.createElement("div");
    const requestFn = vi.fn();
    el.requestFullscreen = requestFn;

    await requestFullscreen(el);

    expect(requestFn).not.toHaveBeenCalled();
  });

  it("calls element.requestFullscreen() when supported", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    const requestFn = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFn;

    await requestFullscreen(el);

    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejection (e.g. gesture too stale, user declined)", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockRejectedValue(new DOMException("denied"));

    await expect(requestFullscreen(el)).resolves.toBeUndefined();
  });

  // Client feedback (docs/decisions.md D-71): landscape rotation while
  // fullscreen, on browsers that support it (Android Chrome) — not called
  // at all when the fullscreen request itself failed/was declined.
  it("locks landscape orientation once fullscreen succeeds, when the API exists", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const lock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(screen, "orientation", { value: { lock }, configurable: true });

    await requestFullscreen(el);

    expect(lock).toHaveBeenCalledWith("landscape");
  });

  it("doesn't attempt to lock orientation when the fullscreen request itself failed", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockRejectedValue(new DOMException("denied"));
    const lock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(screen, "orientation", { value: { lock }, configurable: true });

    await requestFullscreen(el);

    expect(lock).not.toHaveBeenCalled();
  });

  it("does nothing when the orientation-lock API doesn't exist at all (iOS Safari)", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(screen, "orientation", { value: undefined, configurable: true });

    await expect(requestFullscreen(el)).resolves.toBeUndefined();
  });

  it("swallows an orientation-lock rejection the same way as a fullscreen rejection", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const el = document.createElement("div");
    el.requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(screen, "orientation", {
      value: { lock: vi.fn().mockRejectedValue(new DOMException("not supported")) },
      configurable: true,
    });

    await expect(requestFullscreen(el)).resolves.toBeUndefined();
  });
});

describe("exitFullscreenIfActive", () => {
  it("does nothing when nothing is fullscreen", async () => {
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    const exitFn = vi.fn();
    document.exitFullscreen = exitFn;

    await exitFullscreenIfActive();

    expect(exitFn).not.toHaveBeenCalled();
  });

  it("calls document.exitFullscreen() when something is fullscreen", async () => {
    const el = document.createElement("div");
    Object.defineProperty(document, "fullscreenElement", { value: el, configurable: true });
    const exitFn = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFn;

    await exitFullscreenIfActive();

    expect(exitFn).toHaveBeenCalledTimes(1);
  });

  it("unlocks orientation when something is fullscreen and the API exists", async () => {
    const el = document.createElement("div");
    Object.defineProperty(document, "fullscreenElement", { value: el, configurable: true });
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);
    const unlock = vi.fn();
    Object.defineProperty(screen, "orientation", { value: { unlock }, configurable: true });

    await exitFullscreenIfActive();

    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it("doesn't call unlock when nothing is fullscreen", async () => {
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    const unlock = vi.fn();
    Object.defineProperty(screen, "orientation", { value: { unlock }, configurable: true });

    await exitFullscreenIfActive();

    expect(unlock).not.toHaveBeenCalled();
  });
});
