import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductSpinViewer } from "./ProductSpinViewer";

const media = {
  id: "m1",
  width: null,
  height: null,
  blurDataUrl: null,
  renditions: {},
  storagePath: "products/p1/spin.mp4",
  hlsMaster: null,
};

/** jsdom's HTMLMediaElement has no real decoder: duration stays NaN and
 * currentTime doesn't persist without this. Stubbed per element (not the
 * prototype) so each test starts from a clean, independent clock. */
function stubMediaClock(video: HTMLVideoElement, duration: number) {
  let current = 0;
  Object.defineProperty(video, "duration", { configurable: true, get: () => duration });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => current,
    set: (value: number) => {
      current = value;
    },
  });
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  // The idle auto-rotate effect runs on every render via requestAnimationFrame;
  // nothing here asserts on it, and leaving the real rAF loop running against
  // a stubbed clock races with the drag assertions below.
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ProductSpinViewer", () => {
  it("renders a muted, non-autoplaying video with the given poster", () => {
    render(<ProductSpinViewer video={media} posterUrl="https://example.test/poster.jpg" />);
    const video = screen.getByRole("group").querySelector("video") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true);
    expect(video.poster).toBe("https://example.test/poster.jpg");
    expect(video.loop).toBe(false);
  });

  it("dragging left advances currentTime, dragging right reverses it", () => {
    render(<ProductSpinViewer video={media} />);
    const group = screen.getByRole("group");
    const video = group.querySelector("video") as HTMLVideoElement;
    stubMediaClock(video, 8);
    video.currentTime = 2;
    // jsdom does no real layout — clientWidth is 0 for every element unless
    // stubbed, which would zero out the pixelsPerLoop this component derives
    // from it (and timeFromDrag's own guard for that treats 0 as "ignore
    // the drag"), so a real value is needed for this test to exercise
    // anything at all.
    Object.defineProperty(group, "clientWidth", { configurable: true, value: 300 });

    fireEvent.pointerDown(group, { clientX: 100 });
    fireEvent.pointerMove(group, { clientX: 0 }); // dragged left
    expect(video.currentTime).toBeGreaterThan(2);

    fireEvent.pointerMove(group, { clientX: 200 }); // dragged back past the start point, to the right
    expect(video.currentTime).toBeLessThan(2);

    fireEvent.pointerUp(group, { clientX: 200 });
  });

  it("pauses the video when a drag starts", () => {
    render(<ProductSpinViewer video={media} />);
    const group = screen.getByRole("group");
    const video = group.querySelector("video") as HTMLVideoElement;
    stubMediaClock(video, 8);
    const pauseSpy = vi.spyOn(video, "pause");

    fireEvent.pointerDown(group, { clientX: 100 });
    expect(pauseSpy).toHaveBeenCalled();
  });

  it("ArrowLeft/ArrowRight step currentTime without needing a drag", () => {
    render(<ProductSpinViewer video={media} />);
    const group = screen.getByRole("group");
    const video = group.querySelector("video") as HTMLVideoElement;
    stubMediaClock(video, 8);
    video.currentTime = 2;

    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(video.currentTime).toBeCloseTo(1.7, 5);

    fireEvent.keyDown(group, { key: "ArrowLeft" });
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(video.currentTime).toBeCloseTo(2.3, 5);
  });

  it("ignores other keys", () => {
    render(<ProductSpinViewer video={media} />);
    const group = screen.getByRole("group");
    const video = group.querySelector("video") as HTMLVideoElement;
    stubMediaClock(video, 8);
    video.currentTime = 2;

    fireEvent.keyDown(group, { key: "Enter" });
    expect(video.currentTime).toBe(2);
  });
});
