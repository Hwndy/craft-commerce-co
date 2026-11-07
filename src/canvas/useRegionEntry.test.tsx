import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "./store";
import { useRegionEntry } from "./useRegionEntry";

function Probe({ rect, onValue }: { rect: { x: number; y: number; width: number; height: number }; onValue: (v: boolean) => void }) {
  const isEntered = useRegionEntry(rect, { stableMs: 50 });
  onValue(isEntered);
  return <div data-entered={isEntered} />;
}

describe("useRegionEntry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCameraStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 1000, height: 800 },
      isFlying: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 0, height: 0 } });
  });

  it("becomes true once the camera is stable and coverage is above threshold", () => {
    const values: boolean[] = [];
    const region = { x: 0, y: 0, width: 1000, height: 800 }; // fills the viewport
    render(<Probe rect={region} onValue={(v) => values.push(v)} />);

    expect(values.at(-1)).toBe(false); // not yet stable

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(values.at(-1)).toBe(true);
  });

  it("stays false when coverage never reaches the threshold", () => {
    const values: boolean[] = [];
    const region = { x: 0, y: 0, width: 100, height: 800 }; // 10% of viewport width
    render(<Probe rect={region} onValue={(v) => values.push(v)} />);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(values.at(-1)).toBe(false);
  });

  it("resets the stability timer on every camera change (debounce, not poll)", () => {
    const values: boolean[] = [];
    const region = { x: 0, y: 0, width: 1000, height: 800 };
    render(<Probe rect={region} onValue={(v) => values.push(v)} />);

    // Keep moving the camera just before the 50ms window elapses — should
    // never settle into "entered".
    for (let i = 0; i < 3; i++) {
      act(() => {
        vi.advanceTimersByTime(30);
        useCameraStore.getState().setCamera({ x: i, y: 0, zoom: 1 });
      });
    }
    expect(values.at(-1)).toBe(false);

    // Now let it actually settle.
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(values.at(-1)).toBe(true);
  });
});
