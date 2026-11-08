import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useCameraStore } from "./store";
import { useBoardGestures } from "./useBoardGestures";

function Probe() {
  const ref = useRef<HTMLDivElement>(null);
  useBoardGestures(ref);
  return (
    <div ref={ref} data-testid="board">
      <div data-testid="scrollable" data-board-scrollable>
        <div data-testid="inner-child" />
      </div>
      <div data-testid="plain-child" />
    </div>
  );
}

function setScrollMetrics(el: HTMLElement, { scrollTop, clientHeight, scrollHeight }: Record<string, number>) {
  Object.defineProperty(el, "scrollTop", { value: scrollTop, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
}

describe("useBoardGestures wheel handling", () => {
  beforeEach(() => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 1000, height: 800 }, isFlying: false });
  });

  afterEach(() => {
    useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 0, height: 0 } });
  });

  // Found in review (Greptile, PR #3): a shrunk Contact/About panel (T6,
  // useFittedPanelSize) relies on its own overflow-y-auto to reach content
  // past the viewport — but the board's wheel listener sits on the viewport
  // element, which every wheel event bubbles up to, and was always zooming
  // the board instead. A `data-board-scrollable` ancestor with room left to
  // scroll should keep the wheel event for itself.
  it("does not zoom the board when the wheel target is inside a data-board-scrollable element with room to scroll further", () => {
    const { getByTestId } = render(<Probe />);
    setScrollMetrics(getByTestId("scrollable"), { scrollTop: 0, clientHeight: 100, scrollHeight: 300 });

    fireEvent.wheel(getByTestId("inner-child"), { deltaY: 50, clientX: 10, clientY: 10 });

    expect(useCameraStore.getState().camera.zoom).toBe(1);
  });

  it("zooms the board once the scrollable panel has no more room to scroll further in that direction", () => {
    const { getByTestId } = render(<Probe />);
    // scrollTop + clientHeight === scrollHeight: already at the bottom edge.
    setScrollMetrics(getByTestId("scrollable"), { scrollTop: 200, clientHeight: 100, scrollHeight: 300 });

    fireEvent.wheel(getByTestId("inner-child"), { deltaY: 50, clientX: 10, clientY: 10 });

    expect(useCameraStore.getState().camera.zoom).toBeLessThan(1);
  });

  it("still zooms the board for a ctrlKey wheel (trackpad pinch) even over a scrollable panel with room left", () => {
    const { getByTestId } = render(<Probe />);
    setScrollMetrics(getByTestId("scrollable"), { scrollTop: 0, clientHeight: 100, scrollHeight: 300 });

    fireEvent.wheel(getByTestId("inner-child"), { deltaY: 50, clientX: 10, clientY: 10, ctrlKey: true });

    expect(useCameraStore.getState().camera.zoom).toBeLessThan(1);
  });

  it("still zooms the board for wheel events outside any data-board-scrollable element", () => {
    const { getByTestId } = render(<Probe />);

    fireEvent.wheel(getByTestId("plain-child"), { deltaY: -50, clientX: 10, clientY: 10 });

    expect(useCameraStore.getState().camera.zoom).toBeGreaterThan(1);
  });
});
