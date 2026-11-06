import { create } from "zustand";

import { env } from "@/lib/env";

export type AutoplayFallback = "autoplay" | "muted" | "play-button";

interface FilmControllerState {
  videoElement: HTMLVideoElement | null;
  isPrimed: boolean;
  /** Whether the full-screen film layer is the thing on screen right now. */
  isRevealed: boolean;
  fallback: AutoplayFallback;

  registerVideoElement: (el: HTMLVideoElement | null) => void;

  /**
   * Call from inside the "Click to enter" handler, synchronously within the
   * user gesture: play() then pause() the single shared <video> element so
   * it's unlocked for a later programmatic play() once the entry sequence
   * reveals it (docs/landing-audit.md / Phase 1 T8).
   */
  prime: () => void;

  /**
   * Call once the entry sequence reveals the Gallery (or on a direct
   * /gallery visit). Tries unmuted autoplay first (relying on prime()'s
   * gesture credit), then muted with a "tap for sound" pill, then gives up
   * and shows a play button. Respects VITE_FILM_AUTOSTART.
   */
  start: () => Promise<void>;

  reveal: () => void;
  hide: () => void;
  reset: () => void;
}

export const useFilmControllerStore = create<FilmControllerState>((set, get) => ({
  videoElement: null,
  isPrimed: false,
  isRevealed: false,
  fallback: "autoplay",

  registerVideoElement: (el) => set({ videoElement: el }),

  prime: () => {
    const { videoElement, isPrimed } = get();
    if (!videoElement || isPrimed) return;
    videoElement.playsInline = true;
    set({ isPrimed: true });
    const attempt = videoElement.play();
    // pause() runs synchronously, in the same tick as play() — not chained
    // onto the play() promise. Reduced-motion collapses the gap between
    // prime() and start() to ~400ms (vs ~7s for the full entry sequence);
    // if pause() instead waited for the promise to resolve, it could race
    // with and clobber a start() call that landed in between, silently
    // pausing a video that had already begun playing for real.
    videoElement.pause();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        // Even the priming attempt was blocked; start() still runs its own
        // muted / play-button fallback chain regardless.
      });
    }
  },

  start: async () => {
    const { videoElement } = get();
    if (!videoElement) return;

    if (!env.VITE_FILM_AUTOSTART) {
      set({ fallback: "play-button" });
      return;
    }

    try {
      videoElement.muted = false;
      await videoElement.play();
      set({ fallback: "autoplay" });
      return;
    } catch {
      // Fall through to muted.
    }

    try {
      videoElement.muted = true;
      await videoElement.play();
      set({ fallback: "muted" });
      return;
    } catch {
      set({ fallback: "play-button" });
    }
  },

  reveal: () => set({ isRevealed: true }),
  hide: () => set({ isRevealed: false }),
  reset: () => set({ isPrimed: false, fallback: "autoplay" }),
}));
