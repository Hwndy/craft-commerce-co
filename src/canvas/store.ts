import { create } from "zustand";

import {
  DEFAULT_ZOOM_LIMITS,
  clampZoom,
  flightDurationMs,
  interpolateCamera,
} from "./math";
import type { Camera, ZoomLimits } from "./types";

export interface FlyToOptions {
  /** Skip the animation and jump straight to the target (prefers-reduced-motion). */
  reducedMotion?: boolean;
  /** Override the computed flight duration, in ms. */
  durationMs?: number;
}

interface CameraState {
  camera: Camera;
  viewport: { width: number; height: number };
  isFlying: boolean;
  zoomLimits: ZoomLimits;
  setViewport: (width: number, height: number) => void;
  /** Set the camera directly, no animation (e.g. initial mount, route sync). */
  setCamera: (camera: Camera) => void;
  /** Fly the camera to a target over time. Resolves when the flight ends. */
  flyTo: (target: Camera, options?: FlyToOptions) => Promise<void>;
}

export const useCameraStore = create<CameraState>((set, get) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  viewport: { width: 0, height: 0 },
  isFlying: false,
  zoomLimits: DEFAULT_ZOOM_LIMITS,

  setViewport: (width, height) => set({ viewport: { width, height } }),

  setCamera: (camera) => {
    const { zoomLimits } = get();
    set({ camera: { ...camera, zoom: clampZoom(camera.zoom, zoomLimits) } });
  },

  flyTo: (target, options = {}) => {
    const { camera: start, viewport, zoomLimits } = get();
    const targetCamera: Camera = {
      ...target,
      zoom: clampZoom(target.zoom, zoomLimits),
    };

    if (options.reducedMotion) {
      set({ camera: targetCamera, isFlying: false });
      return Promise.resolve();
    }

    const vw = viewport.width || 1;
    const vh = viewport.height || 1;
    const duration =
      options.durationMs ?? flightDurationMs(start, targetCamera, vw, vh);
    const startTime =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    set({ isFlying: true });

    return new Promise<void>((resolve) => {
      function step(now: number) {
        const elapsed = now - startTime;
        const t = Math.min(1, duration > 0 ? elapsed / duration : 1);
        const next = interpolateCamera(start, targetCamera, t, vw, vh);
        set({ camera: next });
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          set({ camera: targetCamera, isFlying: false });
          resolve();
        }
      }
      requestAnimationFrame(step);
    });
  },
}));
