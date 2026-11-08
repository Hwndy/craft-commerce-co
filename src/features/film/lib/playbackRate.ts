/** Speed control's cycle order, starting at normal speed (docs/decisions.md D-45). */
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.5] as const;

/**
 * The rate the Speed button's next click should land on. Falls back to the
 * cycle's first entry for a rate set from outside this control (or not yet
 * synced), rather than throwing or standing still.
 */
export function nextPlaybackRate(current: number): number {
  const index = PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number]);
  if (index === -1) return PLAYBACK_RATES[0];
  return PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
}
