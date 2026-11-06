import { create } from "zustand";

import {
  createTrackingState,
  percentWatched,
  recordTimeUpdate as recordTimeUpdatePure,
  type TrackingState,
} from "./lib/watched-ranges";

const UNLOCK_THRESHOLD = 0.95;

function storageKey(version: number): string {
  return `alllife:film:${version}:unlocked`;
}

function readUnlocked(version: number): boolean {
  try {
    return window.localStorage.getItem(storageKey(version)) === "true";
  } catch {
    return false;
  }
}

function writeUnlocked(version: number): void {
  try {
    window.localStorage.setItem(storageKey(version), "true");
  } catch {
    // Private browsing / storage quota: the gate just re-locks next visit,
    // a safe fallback rather than a hard failure.
  }
}

interface GateState {
  version: number | null;
  tracking: TrackingState;
  duration: number;
  percent: number;
  isUnlocked: boolean;

  /** Call once the film's version is known (from the gallery_film row). Bumping the version re-locks (D-07). */
  initFor: (version: number) => void;
  setDuration: (duration: number) => void;
  /** Call on every `timeupdate` (and once more on `ended`). */
  recordTimeUpdate: (currentTime: number, playbackRate: number, isPlaying: boolean) => void;
}

export const useGateStore = create<GateState>((set, get) => ({
  version: null,
  tracking: createTrackingState(),
  duration: 0,
  percent: 0,
  isUnlocked: false,

  initFor: (version) => {
    if (get().version === version) return;
    set({
      version,
      tracking: createTrackingState(),
      percent: 0,
      isUnlocked: readUnlocked(version),
    });
  },

  setDuration: (duration) => set({ duration }),

  recordTimeUpdate: (currentTime, playbackRate, isPlaying) => {
    const { tracking, duration, version, isUnlocked } = get();
    if (isUnlocked || version === null) return;

    const nextTracking = recordTimeUpdatePure(tracking, currentTime, {
      playbackRate,
      isPlaying,
    });
    const percent = percentWatched(nextTracking.ranges, duration);
    const unlocked = percent >= UNLOCK_THRESHOLD;

    if (unlocked) writeUnlocked(version);
    set({ tracking: nextTracking, percent, isUnlocked: unlocked });
  },
}));
