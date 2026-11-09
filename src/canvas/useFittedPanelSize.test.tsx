import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useCameraStore } from "./store";
import { useFittedPanelSize } from "./useFittedPanelSize";

function Probe({ onValue }: { onValue: (v: { width: number; height: number }) => void }) {
  onValue(useFittedPanelSize(760, 760));
  return null;
}

describe("useFittedPanelSize", () => {
  afterEach(() => {
    useCameraStore.setState({ viewport: { width: 0, height: 0 } });
  });

  it("uses the panel's own maximum size when the viewport is at least that big", () => {
    useCameraStore.setState({ viewport: { width: 1280, height: 900 } });
    let value: { width: number; height: number } | undefined;
    render(<Probe onValue={(v) => (value = v)} />);
    expect(value).toEqual({ width: 760, height: 760 });
  });

  // T6 (found via a real CI failure, mobile-chrome only, PR #3): a Pixel
  // 7's 412px-wide viewport is narrower than a fixed 760px panel — once
  // centred, that left the submit button (left-aligned, not centred
  // within the panel) permanently outside the viewport.
  it("shrinks to fit a narrower viewport, minus the margin on each side", () => {
    useCameraStore.setState({ viewport: { width: 412, height: 839 } });
    let value: { width: number; height: number } | undefined;
    render(<Probe onValue={(v) => (value = v)} />);
    expect(value).toEqual({ width: 412 - 32, height: 760 }); // height still fits (839 > 760)
  });

  it("falls back to the panel's own maximum size before the viewport is known (width/height still 0)", () => {
    let value: { width: number; height: number } | undefined;
    render(<Probe onValue={(v) => (value = v)} />);
    expect(value).toEqual({ width: 760, height: 760 });
  });
});
