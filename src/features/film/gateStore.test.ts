import { beforeEach, describe, expect, it } from "vitest";

import { useGateStore } from "./gateStore";

function play(version: number, duration: number, times: number[]) {
  const { initFor, setDuration, recordTimeUpdate } = useGateStore.getState();
  initFor(version);
  setDuration(duration);
  for (const t of times) {
    recordTimeUpdate(t, 1, true);
  }
}

beforeEach(() => {
  window.localStorage.clear();
  useGateStore.setState({
    version: null,
    tracking: { ranges: [], lastTime: null },
    duration: 0,
    percent: 0,
    isUnlocked: false,
  });
});

describe("initFor", () => {
  it("starts locked with 0% for a film version never seen before", () => {
    useGateStore.getState().initFor(1);
    expect(useGateStore.getState().isUnlocked).toBe(false);
    expect(useGateStore.getState().percent).toBe(0);
  });

  it("is a no-op if already initialised for the same version (doesn't reset progress)", () => {
    useGateStore.getState().initFor(1);
    useGateStore.getState().setDuration(10);
    useGateStore.getState().recordTimeUpdate(0, 1, true);
    useGateStore.getState().recordTimeUpdate(1, 1, true);
    const before = useGateStore.getState().tracking;

    useGateStore.getState().initFor(1);

    expect(useGateStore.getState().tracking).toBe(before);
  });
});

describe("unlocking", () => {
  it("stays locked below the 95% threshold", () => {
    play(1, 20, [0, 1, 2, 3, 4, 5, 6, 7, 8]); // ~8/20 = 40%
    expect(useGateStore.getState().isUnlocked).toBe(false);
  });

  it("unlocks once 95% has genuinely been watched", () => {
    const duration = 20;
    const times = [0];
    for (let t = 0.5; t <= duration; t += 0.5) times.push(t);
    play(1, duration, times);
    expect(useGateStore.getState().isUnlocked).toBe(true);
    expect(useGateStore.getState().percent).toBeGreaterThanOrEqual(0.95);
  });

  it("cannot be unlocked by scrubbing straight to near the end", () => {
    play(600, 600, [0, 597, 597.5, 598, 598.5, 599, 599.5, 600]);
    expect(useGateStore.getState().isUnlocked).toBe(false);
  });
});

describe("persistence", () => {
  it("persists the unlock to localStorage, keyed by version", () => {
    const duration = 10;
    const times = [0];
    for (let t = 0.5; t <= duration; t += 0.5) times.push(t);
    play(7, duration, times);

    expect(window.localStorage.getItem("alllife:film:7:unlocked")).toBe("true");
  });

  it("a returning user (same version) is not re-locked", () => {
    window.localStorage.setItem("alllife:film:3:unlocked", "true");

    useGateStore.getState().initFor(3);

    expect(useGateStore.getState().isUnlocked).toBe(true);
  });

  it("bumping the version re-locks even if the previous version was unlocked (D-07)", () => {
    window.localStorage.setItem("alllife:film:3:unlocked", "true");
    useGateStore.getState().initFor(3);
    expect(useGateStore.getState().isUnlocked).toBe(true);

    useGateStore.getState().initFor(4);

    expect(useGateStore.getState().isUnlocked).toBe(false);
  });

  it("stops tracking further updates once unlocked (no more writes needed)", () => {
    const duration = 10;
    const times = [0];
    for (let t = 0.5; t <= duration; t += 0.5) times.push(t);
    play(1, duration, times);
    const trackingAtUnlock = useGateStore.getState().tracking;

    useGateStore.getState().recordTimeUpdate(duration + 5, 1, true);

    expect(useGateStore.getState().tracking).toBe(trackingAtUnlock);
  });
});
