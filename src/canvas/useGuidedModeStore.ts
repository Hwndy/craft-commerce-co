import { create } from "zustand";

import { clampGuidedIndex, guidedPathViewpoints, nearestGuidedIndex } from "./guidedPath";
import { useCameraStore } from "./store";
import { listViewpoints } from "./viewpoints";

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
      if (path[nearest]) void flyTo(path[nearest], { reducedMotion: prefersReducedMotion() });
      return;
    }

    // "Switching to Explore keeps the camera where it is."
    set({ mode });
  },

  next: async () => {
    const path = guidedPathViewpoints(listViewpoints());
    const nextIndex = clampGuidedIndex(get().currentIndex + 1, path.length);
    set({ currentIndex: nextIndex });
    const target = path[nextIndex];
    if (target) await useCameraStore.getState().flyTo(target, { reducedMotion: prefersReducedMotion() });
  },

  previous: async () => {
    const path = guidedPathViewpoints(listViewpoints());
    const prevIndex = clampGuidedIndex(get().currentIndex - 1, path.length);
    set({ currentIndex: prevIndex });
    const target = path[prevIndex];
    if (target) await useCameraStore.getState().flyTo(target, { reducedMotion: prefersReducedMotion() });
  },

  progress: () => {
    const path = guidedPathViewpoints(listViewpoints());
    return { index: Math.min(get().currentIndex + 1, path.length), total: path.length };
  },
}));
