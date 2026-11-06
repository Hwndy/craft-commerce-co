import type { SealController } from "./types";

/**
 * Wraps the existing landing-page seal, which docs/landing-audit.md found to
 * be a looping <video> (not CSS/canvas/three.js — D-04). Controls playback
 * rate for the speed ramp, and approximates the "finer luminous form" (no
 * separate asset exists) with a CSS brightness/blur treatment in screen
 * blend mode, per the Phase 1 brief's fallback for T6.
 */
export class VideoSealController implements SealController {
  private readonly video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  setSpeed(multiplier: number): void {
    // HTMLMediaElement.playbackRate is reliably supported roughly in 0.0625–16.
    this.video.playbackRate = Math.min(16, Math.max(0.0625, multiplier));
  }

  setLuminous(amount: number): void {
    const clamped = Math.min(1, Math.max(0, amount));
    this.video.style.filter = `brightness(${1 + clamped * 1.2}) blur(${clamped * 1.5}px)`;
    this.video.style.mixBlendMode = clamped > 0 ? "screen" : "normal";
  }

  destroy(): void {
    this.video.style.filter = "";
    this.video.style.mixBlendMode = "";
  }
}
