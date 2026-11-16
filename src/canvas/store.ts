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

// Real root cause of a CI-only (never reproduced locally against a real
// dev server or production build) failure: any code that reads
// `useCameraStore.getState().viewport` to build a camera via
// cameraFromCenter/cameraForViewpoint *before* Board.tsx's own effect has
// run (it calls setViewport synchronously on mount, but Board itself is
// inside Gallery's lazy chunk, which can still be loading) got {0,0} —
// cameraFromCenter(center, zoom, 0, 0) degenerates to `camera = center`
// itself, anchoring the viewpoint's own (x,y) at the screen's top-left
// corner instead of its centre. FilmStage's Continue handler is exactly
// such a call site (T10): a real visitor never hits this in practice
// (watching a film takes far longer than the lazy chunk takes to load),
// but e2e/photo-viewer.spec.ts's revealBoard() helper fakes "watching" a
// video near-instantly via synthetic timeupdate events, closing that gap
// enough to hit it on every real CI run. It only became visible once the
// collage's own layout (D-71, Step 4's "strips" mode) started clustering
// every photo tightly around that one mis-anchored point — the previous,
// far more spread-out "circular" layout happened to still place several
// photos on-screen and chrome-clear by sheer luck, every time, masking
// this for as long as it was the default.
// window.innerWidth/innerHeight are available the instant this module
// evaluates (page load), long before any component mounts, so seeding
// the real size here — rather than {0,0} — means every such call site
// gets a correct viewport even on its very first read. Board's own
// ResizeObserver still corrects this if the real measurement differs
// (scrollbars, etc.) once it mounts.
const initialViewport =
  typeof window !== "undefined"
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: 0, height: 0 };

export const useCameraStore = create<CameraState>((set, get) => ({
  camera: { x: 0, y: 0, zoom: 1 },
  viewport: initialViewport,
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
