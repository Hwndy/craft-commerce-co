export interface Range {
  start: number;
  end: number;
}

export interface TrackingState {
  ranges: Range[];
  lastTime: number | null;
}

export function createTrackingState(): TrackingState {
  return { ranges: [], lastTime: null };
}

/** Merge a new [start, end) interval into a sorted, non-overlapping list. */
export function addRange(ranges: Range[], start: number, end: number): Range[] {
  if (end <= start) return ranges;

  const merged: Range[] = [];
  let candidate = { start, end };
  let i = 0;

  while (i < ranges.length && ranges[i].end < candidate.start) {
    merged.push(ranges[i]);
    i++;
  }
  while (i < ranges.length && ranges[i].start <= candidate.end) {
    candidate = {
      start: Math.min(candidate.start, ranges[i].start),
      end: Math.max(candidate.end, ranges[i].end),
    };
    i++;
  }
  merged.push(candidate);
  while (i < ranges.length) {
    merged.push(ranges[i]);
    i++;
  }
  return merged;
}

/** Fraction (0..1) of `duration` covered by `ranges`. */
export function percentWatched(ranges: Range[], duration: number): number {
  if (duration <= 0) return 0;
  const totalWatched = ranges.reduce((sum, r) => sum + (r.end - r.start), 0);
  return Math.min(1, totalWatched / duration);
}

const MAX_TRACKED_PLAYBACK_RATE = 2;
const MAX_GENUINE_JUMP_SECONDS = 1.5;

export interface RecordTimeUpdateOptions {
  playbackRate: number;
  isPlaying: boolean;
}

/**
 * Called on every `timeupdate`. Only counts the interval as watched when it
 * looks like genuine real-time playback: the player is actually playing,
 * at 2x speed or less, and advanced by under 1.5s since the last update —
 * a seek (a scrub, a `currentTime` jump, or skipping ahead) always produces
 * a bigger jump than normal timeupdate cadence, so it adds nothing.
 * phases/PHASE-1-entry-to-film.md T10.
 */
export function recordTimeUpdate(
  state: TrackingState,
  currentTime: number,
  options: RecordTimeUpdateOptions
): TrackingState {
  const { lastTime, ranges } = state;

  if (!options.isPlaying || lastTime === null) {
    return { ranges, lastTime: currentTime };
  }

  const delta = currentTime - lastTime;
  const isGenuine =
    options.playbackRate <= MAX_TRACKED_PLAYBACK_RATE &&
    delta > 0 &&
    delta < MAX_GENUINE_JUMP_SECONDS;

  if (!isGenuine) {
    return { ranges, lastTime: currentTime };
  }

  return { ranges: addRange(ranges, lastTime, currentTime), lastTime: currentTime };
}
