import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCameraStore } from "./store";
import { useBoardKeyboard } from "./useBoardKeyboard";

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  useBoardKeyboard(ref);
  return (
    <div ref={ref} tabIndex={0} data-testid="board">
      <input data-testid="text-input" />
      <button type="button" role="combobox" data-testid="select-trigger">
        pick
      </button>
      <div data-testid="plain-child" />
    </div>
  );
}

describe("useBoardKeyboard", () => {
  beforeEach(() => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 1000, height: 800 }, isFlying: false });
  });

  afterEach(() => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 0, height: 0 } });
  });

  // T6 (found in review, Greptile PR #3): About/Contact's EnquiryForm is
  // the first real text field mounted directly inside the board's own
  // tree (ProductOverlay's identical form is unaffected — its Dialog
  // portals to document.body, outside this handler's subtree entirely) —
  // without this guard, every one of these keys was silently hijacked
  // while a visitor was typing into it.
  it("does not pan/zoom/recentre when the keydown target is a text input", () => {
    const { getByTestId } = render(<Probe />);
    const input = getByTestId("text-input");

    fireEvent.keyDown(input, { key: "ArrowLeft" });
    fireEvent.keyDown(input, { key: "-" });
    fireEvent.keyDown(input, { key: "0" });

    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("does not react when the keydown target is a Select trigger (role=combobox)", () => {
    const { getByTestId } = render(<Probe />);
    const trigger = getByTestId("select-trigger");

    fireEvent.keyDown(trigger, { key: "ArrowRight" });

    expect(useCameraStore.getState().camera).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it("still pans the board for every other keydown target", () => {
    const { getByTestId } = render(<Probe />);
    const plainChild = getByTestId("plain-child");

    fireEvent.keyDown(plainChild, { key: "ArrowRight" });

    expect(useCameraStore.getState().camera.x).toBeGreaterThan(0);
  });
});
