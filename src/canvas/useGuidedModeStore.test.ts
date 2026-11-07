import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "./store";
import { clearViewpointsCache, setViewpointsCache } from "./viewpoints";
import { useGuidedModeStore } from "./useGuidedModeStore";

const path = [
  { key: "landing", label: "Landing", x: 0, y: 0, zoom: 1, sortOrder: 0, inGuidedPath: true },
  { key: "gallery", label: "Gallery", x: 2000, y: 0, zoom: 1, sortOrder: 1, inGuidedPath: true },
  { key: "shop", label: "Shop", x: -2000, y: 0, zoom: 1, sortOrder: 2, inGuidedPath: true },
  { key: "secret", label: "Secret", x: 9999, y: 0, zoom: 1, sortOrder: 3, inGuidedPath: false },
];

beforeEach(() => {
  window.localStorage.clear();
  setViewpointsCache(path);
  useGuidedModeStore.setState({ mode: "guided", currentIndex: 0 });
  useCameraStore.setState({
    camera: { x: 0, y: 0, zoom: 1 },
    viewport: { width: 1000, height: 800 },
    isFlying: false,
  });
  // next()/previous()/setMode() check prefers-reduced-motion to decide
  // whether flyTo() animates (900-2200ms, real rAF frames) or jumps
  // instantly — force the instant path so these tests are fast and
  // deterministic rather than genuinely waiting out real flights.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearViewpointsCache();
});

describe("initial mode (docs/02-canvas-spec.md §6: Guided by default on first visit)", () => {
  // readStoredMode() only runs once, at module import — vi.resetModules()
  // plus a dynamic re-import gets a fresh module instance that reads
  // localStorage again, the only way to actually exercise "on first load."
  it("defaults to guided when nothing is stored", async () => {
    window.localStorage.clear();
    vi.resetModules();
    const fresh = await import("./useGuidedModeStore");
    expect(fresh.useGuidedModeStore.getState().mode).toBe("guided");
  });

  it("respects a previously stored mode on load", async () => {
    window.localStorage.setItem("alllife:canvas:mode", "explore");
    vi.resetModules();
    const fresh = await import("./useGuidedModeStore");
    expect(fresh.useGuidedModeStore.getState().mode).toBe("explore");
  });
});

describe("next / previous", () => {
  it("next flies forward through the guided path only (excludes inGuidedPath=false)", async () => {
    await useGuidedModeStore.getState().next();
    expect(useGuidedModeStore.getState().currentIndex).toBe(1);
    expect(useCameraStore.getState().camera.x).toBeCloseTo(2000);
  });

  it("clamps at the end of the path instead of wrapping", async () => {
    await useGuidedModeStore.getState().next();
    await useGuidedModeStore.getState().next();
    await useGuidedModeStore.getState().next(); // one past the last (shop is index 2)
    expect(useGuidedModeStore.getState().currentIndex).toBe(2);
    expect(useCameraStore.getState().camera.x).toBeCloseTo(-2000);
  });

  it("previous clamps at the start of the path", async () => {
    await useGuidedModeStore.getState().previous();
    expect(useGuidedModeStore.getState().currentIndex).toBe(0);
    expect(useCameraStore.getState().camera.x).toBeCloseTo(0);
  });
});

describe("progress", () => {
  it("reports 1-indexed position and the guided-path-only total", async () => {
    expect(useGuidedModeStore.getState().progress()).toEqual({ index: 1, total: 3 });
    await useGuidedModeStore.getState().next();
    expect(useGuidedModeStore.getState().progress()).toEqual({ index: 2, total: 3 });
  });
});

describe("setMode", () => {
  it("switching to explore keeps the camera where it is", () => {
    useCameraStore.getState().setCamera({ x: 777, y: 0, zoom: 1 });
    useGuidedModeStore.getState().setMode("explore");
    expect(useGuidedModeStore.getState().mode).toBe("explore");
    expect(useCameraStore.getState().camera.x).toBe(777);
  });

  it("persists the choice to localStorage", () => {
    useGuidedModeStore.getState().setMode("explore");
    expect(window.localStorage.getItem("alllife:canvas:mode")).toBe("explore");
  });

  it("switching back to guided flies to the nearest path viewpoint", async () => {
    useGuidedModeStore.setState({ mode: "explore" });
    useCameraStore.getState().setCamera({ x: 1900, y: 0, zoom: 1 }); // closest to "gallery" (2000)

    useGuidedModeStore.getState().setMode("guided");
    // flyTo is async (rAF-driven) — wait for it to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(useGuidedModeStore.getState().currentIndex).toBe(1); // gallery's index in the path
  });

  it("is a no-op when setting the same mode it's already in", () => {
    const before = useGuidedModeStore.getState();
    useGuidedModeStore.getState().setMode("guided");
    expect(useGuidedModeStore.getState()).toBe(before);
  });
});

