import { afterEach, describe, expect, it, vi } from "vitest";

import { exitFullscreenIfActive, isFullscreenSupported, requestFullscreen } from "./fullscreen";

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(document, "fullscreenEnabled", { value: false, configurable: true });
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
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
});
