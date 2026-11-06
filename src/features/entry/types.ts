export type EntryPhase =
  | "idle"
  | "accelerating"
  | "burst"
  | "flood"
  | "reveal"
  | "done";

export interface EntryState {
  phase: EntryPhase;
  elapsedMs: number;
  /** Seal playback-rate multiplier (1x idle to ~6x). */
  speedMultiplier: number;
  /** RaysCanvas intensity, 0..1. */
  rayIntensity: number;
  /** FloodOverlay opacity, 0..1. Never decreases before the reveal phase. */
  floodOpacity: number;
  /** SealController.setLuminous argument, 0..1. */
  luminousAmount: number;
  isComplete: boolean;
}

/** What the seal implementation this phase found (docs/landing-audit.md) exposes. */
export interface SealController {
  setSpeed(multiplier: number): void;
  setLuminous(amount: number): void;
  destroy(): void;
}
