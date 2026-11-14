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
    // setCamera() and these synchronous checks. (This subscribe was once
    // credited as the "confirmed root cause" of e2e/canvas-gestures.
    // spec.ts's CI flakiness — wrong; see data-camera-flying below and
    // docs/decisions.md D-66 for the real one.)
    useCameraStore.getState().setCamera({ x: 123, y: 45, zoom: 2 });

    expect(viewport).toHaveAttribute("data-camera-x", "123");
    expect(viewport).toHaveAttribute("data-camera-y", "45");
    expect(viewport).toHaveAttribute("data-camera-zoom", "2");
  });

  // D-66: e2e/canvas-gestures.spec.ts's revealBoard() needs a reliable way
  // to wait for an in-flight flyTo() (Continue's own, in FilmStage.tsx) to
  // actually settle before driving a gesture through the same camera
  // store — racing it silently clobbers a single-shot gesture's write on
  // flyTo's very next frame, with nothing to retry it. This attribute is
  // what that wait polls for.
  it("reflects isFlying synchronously via data-camera-flying, independent of any animation frame having run", () => {
    const { container } = render(<Board />);
    const viewport = container.querySelector('[tabindex="0"]');

    useCameraStore.setState({ isFlying: true });
    expect(viewport).toHaveAttribute("data-camera-flying", "true");

    useCameraStore.setState({ isFlying: false });
    expect(viewport).toHaveAttribute("data-camera-flying", "false");
  });
});
