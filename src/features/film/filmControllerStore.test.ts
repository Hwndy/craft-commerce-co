import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFilmControllerStore } from "./filmControllerStore";

function createMockVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const video = document.createElement("video");
  Object.assign(video, overrides);
  return video;
}

beforeEach(() => {
  useFilmControllerStore.setState({
    videoElement: null,
    isPrimed: false,
    isRevealed: false,
    fallback: "autoplay",
  });
});

describe("prime", () => {
  it("calls play() then pause() synchronously (no await) on the registered element, marking it primed", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const pause = vi.fn();
    const video = createMockVideo({ play, pause });
    useFilmControllerStore.getState().registerVideoElement(video);

    useFilmControllerStore.getState().prime();

    // pause() must happen in the same synchronous tick as play() — not
    // chained onto the play() promise — or it can race with and clobber a
    // start() call that lands shortly after (reduced-motion collapses that
    // gap to ~400ms). See the comment in filmControllerStore.ts.
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(useFilmControllerStore.getState().isPrimed).toBe(true);
  });

  it("does not let a later start() call race with its own pause()", async () => {
    const callOrder: string[] = [];
    const play = vi.fn().mockImplementation(() => {
      callOrder.push("play");
      return Promise.resolve().then(() => callOrder.push("play-resolved"));
    });
    const pause = vi.fn().mockImplementation(() => callOrder.push("pause"));
    const video = createMockVideo({ play, pause });
    useFilmControllerStore.getState().registerVideoElement(video);

    useFilmControllerStore.getState().prime();
    await useFilmControllerStore.getState().start();

    // pause (from prime) must come immediately after the first play call,
    // never after the second (start's) play call resolves.
    const pauseIndex = callOrder.indexOf("pause");
    const secondPlayIndex = callOrder.indexOf("play", callOrder.indexOf("play") + 1);
    expect(pauseIndex).toBeGreaterThanOrEqual(0);
    expect(pauseIndex).toBeLessThan(secondPlayIndex);
  });

  it("is a no-op if there is no registered element", () => {
    expect(() => useFilmControllerStore.getState().prime()).not.toThrow();
    expect(useFilmControllerStore.getState().isPrimed).toBe(false);
  });

  it("does not prime twice", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const video = createMockVideo({ play, pause: vi.fn() });
    useFilmControllerStore.getState().registerVideoElement(video);

    useFilmControllerStore.getState().prime();
    useFilmControllerStore.getState().prime();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not throw when even the priming play() attempt rejects", async () => {
    const play = vi.fn().mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    const video = createMockVideo({ play, pause: vi.fn() });
    useFilmControllerStore.getState().registerVideoElement(video);

    expect(() => useFilmControllerStore.getState().prime()).not.toThrow();
    expect(useFilmControllerStore.getState().isPrimed).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
  });
});

describe("start", () => {
  it("plays unmuted when the browser allows it (the common case after priming)", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const video = createMockVideo({ play, muted: true });
    useFilmControllerStore.getState().registerVideoElement(video);

    await useFilmControllerStore.getState().start();

    expect(video.muted).toBe(false);
    expect(useFilmControllerStore.getState().fallback).toBe("autoplay");
  });

  it("falls back to muted when unmuted play() is rejected", async () => {
    const play = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("blocked", "NotAllowedError"))
      .mockResolvedValueOnce(undefined);
    const video = createMockVideo({ play });
    useFilmControllerStore.getState().registerVideoElement(video);

    await useFilmControllerStore.getState().start();

    expect(play).toHaveBeenCalledTimes(2);
    expect(video.muted).toBe(true);
    expect(useFilmControllerStore.getState().fallback).toBe("muted");
  });

  it("falls back to a play button when even muted play() is rejected", async () => {
    const play = vi.fn().mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    const video = createMockVideo({ play });
    useFilmControllerStore.getState().registerVideoElement(video);

    await useFilmControllerStore.getState().start();

    expect(play).toHaveBeenCalledTimes(2);
    expect(useFilmControllerStore.getState().fallback).toBe("play-button");
  });

  it("never results in a black screen: fallback is always one of the three defined states", async () => {
    const play = vi.fn().mockRejectedValue(new Error("blocked"));
    const video = createMockVideo({ play });
    useFilmControllerStore.getState().registerVideoElement(video);

    await useFilmControllerStore.getState().start();

    expect(["autoplay", "muted", "play-button"]).toContain(
      useFilmControllerStore.getState().fallback
    );
  });

  it("is a no-op if there is no registered element", async () => {
    await expect(useFilmControllerStore.getState().start()).resolves.toBeUndefined();
  });
});

describe("reveal / hide / reset", () => {
  it("toggles isRevealed", () => {
    useFilmControllerStore.getState().reveal();
    expect(useFilmControllerStore.getState().isRevealed).toBe(true);
    useFilmControllerStore.getState().hide();
    expect(useFilmControllerStore.getState().isRevealed).toBe(false);
  });

  it("resets priming state without touching the registered element or isRevealed", () => {
    const video = createMockVideo();
    useFilmControllerStore.getState().registerVideoElement(video);
    useFilmControllerStore.getState().reveal();
    useFilmControllerStore.setState({ isPrimed: true, fallback: "muted" });

    useFilmControllerStore.getState().reset();

    expect(useFilmControllerStore.getState().isPrimed).toBe(false);
    expect(useFilmControllerStore.getState().fallback).toBe("autoplay");
    expect(useFilmControllerStore.getState().isRevealed).toBe(true);
    expect(useFilmControllerStore.getState().videoElement).toBe(video);
  });
});
