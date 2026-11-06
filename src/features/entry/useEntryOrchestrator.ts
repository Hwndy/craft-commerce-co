import { useCallback, useEffect, useRef, useState } from "react";

import {
  ENTRY_TOTAL_MS,
  REDUCED_MOTION_TOTAL_MS,
  computeEntryState,
  computeReducedMotionState,
} from "./EntryOrchestrator";
import type { EntryState } from "./types";

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
  /** Jump straight to the end (still calls onDone once). */
  skip: () => void;
}

/**
 * Drives EntryOrchestrator's pure time->state function from
 * requestAnimationFrame. `onDone` fires exactly once, however the sequence
 * ends (completes naturally or is skipped).
 */
export function useEntryOrchestrator(onDone?: () => void): UseEntryOrchestratorResult {
  const reducedMotion = usePrefersReducedMotion();
  const computeState = reducedMotion ? computeReducedMotionState : computeEntryState;

  const [state, setState] = useState<EntryState>(() => computeState(0));
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

  const start = useCallback(() => {
    if (startTimeRef.current !== null) return;
    startTimeRef.current = performance.now();

    function tick(now: number) {
      const elapsed = now - (startTimeRef.current ?? now);
      const next = computeState(elapsed);
      setState(next);
      if (next.isComplete) {
        frameRef.current = null;
        if (!isDoneRef.current) {
          isDoneRef.current = true;
          onDoneRef.current?.();
        }
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [computeState]);

  const skip = useCallback(() => {
    stop();
    const finalElapsed = reducedMotion ? REDUCED_MOTION_TOTAL_MS : ENTRY_TOTAL_MS;
    setState(computeState(finalElapsed));
    if (!isDoneRef.current) {
      isDoneRef.current = true;
      onDoneRef.current?.();
    }
  }, [computeState, reducedMotion, stop]);

  return { state, reducedMotion, start, skip };
}
