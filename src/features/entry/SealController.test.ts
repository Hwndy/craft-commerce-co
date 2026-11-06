import { describe, expect, it } from "vitest";

import { VideoSealController } from "./SealController";

function createVideo(): HTMLVideoElement {
  return document.createElement("video");
}

describe("VideoSealController", () => {
  it("sets the video's playbackRate, clamped to a safe range", () => {
    const video = createVideo();
    const controller = new VideoSealController(video);

    controller.setSpeed(3);
    expect(video.playbackRate).toBeCloseTo(3);

    controller.setSpeed(100);
    expect(video.playbackRate).toBeCloseTo(16);

    controller.setSpeed(0);
    expect(video.playbackRate).toBeCloseTo(0.0625);
  });

  it("applies a brightness/blur/screen-blend treatment for the luminous form", () => {
    const video = createVideo();
    const controller = new VideoSealController(video);

    controller.setLuminous(0);
    expect(video.style.mixBlendMode).toBe("normal");

    controller.setLuminous(1);
    expect(video.style.filter).toContain("brightness");
    expect(video.style.filter).toContain("blur");
    expect(video.style.mixBlendMode).toBe("screen");
  });

  it("clears the applied styles on destroy", () => {
    const video = createVideo();
    const controller = new VideoSealController(video);
    controller.setLuminous(1);
    controller.destroy();
    expect(video.style.filter).toBe("");
    expect(video.style.mixBlendMode).toBe("");
  });
});
