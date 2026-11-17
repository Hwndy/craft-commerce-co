// "accelerating"/"burst"/"flood"/"reveal" (the CSS-faked sub-stages) are
// gone — the owner's own transition video (docs/decisions.md) replaced
// that fakery with one real clip played start to finish, so there's
// nothing left to sub-divide for normal motion. "transitioning" covers
// the whole thing, from click to the video's own `ended` event.
export type EntryPhase = "idle" | "transitioning" | "done";

export interface EntryState {
  phase: EntryPhase;
  elapsedMs: number;
  /** FloodOverlay opacity, 0..1. Reduced motion only — see computeReducedMotionState. */
  floodOpacity: number;
  isComplete: boolean;
}
