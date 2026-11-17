import { useCallback, useEffect, useRef, useState } from "react";

import { REDUCED_MOTION_TOTAL_MS, computeReducedMotionState } from "./EntryOrchestrator";
import type { EntryState } from "./types";

const IDLE_STATE: EntryState = {
  phase: "idle",
  elapsedMs: 0,
  floodOpacity: 0,
  isComplete: false,
};

const DONE_STATE: EntryState = {
  phase: "done",
  elapsedMs: 0,
  floodOpacity: 0,
  isComplete: true,
};

const TRANSITIONING_STATE: EntryState = {
  phase: "transitioning",
  elapsedMs: 0,
  floodOpacity: 0,
  isComplete: false,
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export interface UseEntryOrchestratorResult {
  state: EntryState;
  reducedMotion: boolean;
  /** Begin the sequence. No-op if already started. */
  start: () => void;
  /**
   * Normal motion only: the transition video reached its own `ended` event
   * (or LandingVideo.tsx's safety-net timeout fired). Flips to "done" and
   * fires onDone. Reduced motion never calls this — its own rAF loop
   * reaches "done" on its own.
   */
  finish: () => void;
  /** Jump straight to the end (still calls onDone once). */
  skip: () => void;
}

/**
 * Normal motion: a plain phase flag. LandingVideo.tsx owns the actual
 * transition video and drives `finish()` off its `ended` event; there's no
 * elapsed-time curve left to compute here (see EntryOrchestrator.ts).
 *
 * Reduced motion: still drives EntryOrchestrator's pure time->state function
 * from requestAnimationFrame, unchanged. `onDone` fires exactly once however
 * the sequence ends (completes naturally or is skipped).
 */
export function useEntryOrchestrator(onDone?: () => void): UseEntryOrchestratorResult {
  const reducedMotion = usePrefersReducedMotion();

  const [state, setState] = useState<EntryState>(() =>
    reducedMotion ? computeReducedMotionState(0) : IDLE_STATE
  );
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const isDoneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const complete = useCallback(() => {
    if (!isDoneRef.current) {
      isDoneRef.current = true;
      onDoneRef.current?.();
    }
  }, []);

  const start = useCallback(() => {
    if (startTimeRef.current !== null) return;
    startTimeRef.current = performance.now();

    if (!reducedMotion) {
      setState(TRANSITIONING_STATE);
      return;
    }

    function tick(now: number) {
      const elapsed = now - (startTimeRef.current ?? now);
      const next = computeReducedMotionState(elapsed);
      setState(next);
      if (next.isComplete) {
        frameRef.current = null;
        complete();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [reducedMotion, complete]);

  const finish = useCallback(() => {
    setState(DONE_STATE);
    complete();
  }, [complete]);

  const skip = useCallback(() => {
    stop();
    setState(reducedMotion ? computeReducedMotionState(REDUCED_MOTION_TOTAL_MS) : DONE_STATE);
    complete();
  }, [reducedMotion, stop, complete]);

  return { state, reducedMotion, start, finish, skip };
}
