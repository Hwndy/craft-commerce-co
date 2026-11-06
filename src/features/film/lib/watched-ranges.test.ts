import { describe, expect, it } from "vitest";

import {
  addRange,
  createTrackingState,
  percentWatched,
  recordTimeUpdate,
  type TrackingState,
} from "./watched-ranges";

describe("addRange", () => {
  it("adds a first range", () => {
    expect(addRange([], 0, 10)).toEqual([{ start: 0, end: 10 }]);
  });

  it("keeps disjoint ranges separate", () => {
    expect(addRange([{ start: 0, end: 10 }], 20, 30)).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });

  it("merges an overlapping range", () => {
    expect(addRange([{ start: 0, end: 10 }], 5, 15)).toEqual([{ start: 0, end: 15 }]);
  });

  it("merges an adjacent (touching) range", () => {
    expect(addRange([{ start: 0, end: 10 }], 10, 20)).toEqual([{ start: 0, end: 20 }]);
  });

  it("merges a range that bridges two existing ranges", () => {
    const ranges = [
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ];
    expect(addRange(ranges, 8, 22)).toEqual([{ start: 0, end: 30 }]);
  });

  it("is a no-op for a zero or negative-length interval", () => {
    expect(addRange([{ start: 0, end: 10 }], 5, 5)).toEqual([{ start: 0, end: 10 }]);
    expect(addRange([{ start: 0, end: 10 }], 5, 2)).toEqual([{ start: 0, end: 10 }]);
  });

  it("fully subsumes a range contained within the new interval", () => {
    const ranges = [{ start: 5, end: 6 }];
    expect(addRange(ranges, 0, 10)).toEqual([{ start: 0, end: 10 }]);
  });
});

describe("percentWatched", () => {
  it("is 0 for no ranges", () => {
    expect(percentWatched([], 100)).toBe(0);
  });

  it("is 0 when duration is unknown (0 or negative)", () => {
    expect(percentWatched([{ start: 0, end: 10 }], 0)).toBe(0);
  });

  it("computes the watched fraction, summed across disjoint ranges", () => {
    const ranges = [
      { start: 0, end: 10 },
      { start: 50, end: 60 },
    ];
    expect(percentWatched(ranges, 100)).toBeCloseTo(0.2);
  });

  it("clamps to 1 even if ranges somehow exceed the duration", () => {
    expect(percentWatched([{ start: 0, end: 150 }], 100)).toBe(1);
  });
});

describe("recordTimeUpdate", () => {
  function play(state: TrackingState, time: number, rate = 1): TrackingState {
    return recordTimeUpdate(state, time, { playbackRate: rate, isPlaying: true });
  }

  it("does nothing on the very first update (no previous time to compare)", () => {
    const state = recordTimeUpdate(createTrackingState(), 5, { playbackRate: 1, isPlaying: true });
    expect(state.ranges).toEqual([]);
    expect(state.lastTime).toBe(5);
  });

  it("accumulates watched ranges across normal small forward steps", () => {
    let state = createTrackingState();
    state = play(state, 0);
    state = play(state, 0.5);
    state = play(state, 1.0);
    state = play(state, 1.5);
    expect(percentWatched(state.ranges, 10)).toBeCloseTo(0.15);
  });

  it("ignores updates while not playing (e.g. a paused/seeking timeupdate), but still tracks lastTime", () => {
    let state = createTrackingState();
    state = play(state, 0);
    state = recordTimeUpdate(state, 5, { playbackRate: 1, isPlaying: false });
    expect(state.ranges).toEqual([]);
    expect(state.lastTime).toBe(5);
    // Playback resumes from 5 — no large jump is recorded since lastTime caught up.
    state = play(state, 5.3);
    expect(state.ranges).toEqual([{ start: 5, end: 5.3 }]);
  });

  it("rejects a seek forward (jump over the gap-threshold) and does not fill the gap", () => {
    let state = createTrackingState();
    state = play(state, 0);
    state = play(state, 10); // simulated seek: a 10s jump in one timeupdate
    expect(state.ranges).toEqual([]);
    expect(state.lastTime).toBe(10);
    // Playback continues genuinely from the new position.
    state = play(state, 10.5);
    expect(state.ranges).toEqual([{ start: 10, end: 10.5 }]);
  });

  it("rejects a seek backward the same way", () => {
    let state = createTrackingState();
    state = play(state, 50);
    state = play(state, 2); // seek back to the start
    expect(state.ranges).toEqual([]);
    expect(state.lastTime).toBe(2);
  });

  it("does not count time while playbackRate is above 2x (abuse prevention)", () => {
    let state = createTrackingState();
    state = play(state, 0);
    state = play(state, 1, 3); // playing, small forward step, but 3x speed
    expect(state.ranges).toEqual([]);
    expect(state.lastTime).toBe(1);
  });

  it("does count at exactly 2x speed", () => {
    let state = createTrackingState();
    state = play(state, 0, 2);
    state = play(state, 1, 2);
    expect(state.ranges).toEqual([{ start: 0, end: 1 }]);
  });

  it("a full honest watch-through reaches ~100%, scrubbing over unwatched parts does not", () => {
    const duration = 20;
    let state = createTrackingState();
    state = play(state, 0);
    for (let t = 0.5; t <= duration; t += 0.5) {
      state = play(state, t);
    }
    expect(percentWatched(state.ranges, duration)).toBeGreaterThanOrEqual(0.95);
  });

  it("cannot be unlocked by seeking straight to the end and letting a few seconds play", () => {
    const duration = 600; // a 10-minute film
    let state = createTrackingState();
    state = play(state, 0);
    state = play(state, duration - 3); // skip to 3s before the end
    state = play(state, duration - 2.5);
    state = play(state, duration - 2);
    state = play(state, duration - 1.5);
    state = play(state, duration - 1);
    state = play(state, duration - 0.5);
    state = play(state, duration);
    expect(percentWatched(state.ranges, duration)).toBeLessThan(0.95);
  });
});
