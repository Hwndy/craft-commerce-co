import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Board } from "./Board";
import { useCameraStore } from "./store";

describe("Board", () => {
  beforeEach(() => {
    useCameraStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 1000, height: 800 },
      isFlying: false,
    });
  });

  it("updates data-camera-* synchronously on a store change, independent of any animation frame having run", () => {
    const { container } = render(<Board />);
    // Not `[data-camera-zoom]`: that attribute doesn't exist at all until
    // the first write (rAF tick or this fix's subscribe), which is exactly
    // what hasn't happened yet here. Board's own outer viewport div is the
    // one stable thing to find it by (tabIndex={0}, set unconditionally).
    const viewport = container.querySelector('[tabindex="0"]');
    expect(viewport).not.toBeNull();

    // No await, no act(async ...), no waitFor — this file's own fix is
    // exactly that these attributes must be correct here, synchronously,
    // without waiting for requestAnimationFrame to ever run. If this only
    // worked via the rAF loop, the assertions below would still see the
    // stale 0/0/1 values, since no frame gets a chance to fire between
    // setCamera() and these synchronous checks (confirmed root cause of
    // e2e/canvas-gestures.spec.ts's CI flakiness: real CI can stall rAF
    // past even a 15s test timeout under parallel-worker CPU contention).
    useCameraStore.getState().setCamera({ x: 123, y: 45, zoom: 2 });

    expect(viewport).toHaveAttribute("data-camera-x", "123");
    expect(viewport).toHaveAttribute("data-camera-y", "45");
    expect(viewport).toHaveAttribute("data-camera-zoom", "2");
  });
});
