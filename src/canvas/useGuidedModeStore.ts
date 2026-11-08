import { create } from "zustand";

import { clampGuidedIndex, guidedPathViewpoints, nearestGuidedIndex } from "./guidedPath";
import { useCameraStore } from "./store";
import { cameraForViewpoint, listViewpoints } from "./viewpoints";

export type ExploreMode = "guided" | "explore";

const MODE_STORAGE_KEY = "alllife:canvas:mode";

function readStoredMode(): ExploreMode | null {
  try {
    const value = window.localStorage.getItem(MODE_STORAGE_KEY);
    return value === "guided" || value === "explore" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredMode(mode: ExploreMode): void {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Private browsing / storage quota: falls back to guided-by-default
    // next visit, a safe choice rather than a hard failure.
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

interface GuidedModeState {
  /** docs/02-canvas-spec.md §6: first-time visitors default to Guided. */
  mode: ExploreMode;
  currentIndex: number;
  setMode: (mode: ExploreMode) => void;
  /** Jumps guided position directly to `index` (e.g. a region-tab click),
   * without flying the camera — the caller (CanvasChrome's own
   * flyToViewpoint) does that part, same division of labour as next()/
   * previous() but for an arbitrary target instead of +-1. */
  setIndex: (index: number) => void;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  /** 1-indexed position in the path, for a "2 of 6" style indicator. */
  progress: () => { index: number; total: number };
}

export const useGuidedModeStore = create<GuidedModeState>((set, get) => ({
  mode: readStoredMode() ?? "guided",
  currentIndex: 0,

  setMode: (mode) => {
    const previousMode = get().mode;
    if (previousMode === mode) return;
    writeStoredMode(mode);

    if (mode === "guided" && previousMode === "explore") {
      // "switching back flies to the nearest path viewpoint" (§6).
      const path = guidedPathViewpoints(listViewpoints());
      const { camera, viewport, flyTo } = useCameraStore.getState();
      const nearest = nearestGuidedIndex(camera, path, viewport.width, viewport.height);
      set({ mode, currentIndex: nearest });
      // cameraForViewpoint: see CanvasChrome.tsx's flyToViewpoint — a
      // no-op for every region but About/Contact (T6).
      if (path[nearest]) void flyTo(cameraForViewpoint(path[nearest], viewport), { reducedMotion: prefersReducedMotion() });
      return;
    }

    // "Switching to Explore keeps the camera where it is."
    set({ mode });
  },

  setIndex: (index) => set({ currentIndex: index }),

  next: async () => {
    const path = guidedPathViewpoints(listViewpoints());
    const nextIndex = clampGuidedIndex(get().currentIndex + 1, path.length);
    set({ currentIndex: nextIndex });
    const target = path[nextIndex];
    if (target) {
      const { viewport, flyTo } = useCameraStore.getState();
      await flyTo(cameraForViewpoint(target, viewport), { reducedMotion: prefersReducedMotion() });
    }
  },

  previous: async () => {
    const path = guidedPathViewpoints(listViewpoints());
    const prevIndex = clampGuidedIndex(get().currentIndex - 1, path.length);
    set({ currentIndex: prevIndex });
    const target = path[prevIndex];
    if (target) {
      const { viewport, flyTo } = useCameraStore.getState();
      await flyTo(cameraForViewpoint(target, viewport), { reducedMotion: prefersReducedMotion() });
    }
  },

  progress: () => {
    const path = guidedPathViewpoints(listViewpoints());
    return { index: Math.min(get().currentIndex + 1, path.length), total: path.length };
  },
}));
