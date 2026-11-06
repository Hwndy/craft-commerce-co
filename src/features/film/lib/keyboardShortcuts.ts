export type PlayerAction =
  | { type: "toggle-play" }
  | { type: "toggle-mute" }
  | { type: "seek-relative"; deltaSeconds: number }
  | { type: "seek-to-start" }
  | { type: "seek-to-end" }
  | { type: "seek-to-percent"; percent: number };

const DIGIT_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Pure key -> player action mapping, per docs/01-architecture.md... no —
 * phases/PHASE-1-entry-to-film.md T9: Space/K play-pause, M mute,
 * Left/Right 5s, Home/End, number keys jump to 0–90% of the duration.
 * Kept DOM-free so it's trivially unit-testable.
 */
export function actionForKey(key: string): PlayerAction | null {
  if (key === " " || key === "Spacebar" || key === "k" || key === "K") {
    return { type: "toggle-play" };
  }
  if (key === "m" || key === "M") {
    return { type: "toggle-mute" };
  }
  if (key === "ArrowLeft") {
    return { type: "seek-relative", deltaSeconds: -5 };
  }
  if (key === "ArrowRight") {
    return { type: "seek-relative", deltaSeconds: 5 };
  }
  if (key === "Home") {
    return { type: "seek-to-start" };
  }
  if (key === "End") {
    return { type: "seek-to-end" };
  }
  if (DIGIT_KEYS.includes(key)) {
    return { type: "seek-to-percent", percent: Number(key) * 10 };
  }
  return null;
}
