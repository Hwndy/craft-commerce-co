import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for a chain of real production incidents around film
 * playback, in order — see docs/decisions.md D-38 through D-42 for the
 * full narrative:
 *
 * D-38/D-39/D-41: three rounds of increasingly elaborate custom recovery
 * logic (progress-based resets, backoff, a sliding time window) layered
 * onto hls.js's fatal-error handling, none of which actually fixed the
 * real symptom. A 4th incident report showed why: every repeated segment
 * request in the browser's Network tab was a `304` (succeeding, served
 * from cache) — meaning hls.js may never have raised the `fatal` errors
 * any of that logic was reacting to in the first place.
 *
 * D-40: a real root cause that *was* confirmed (a browser-console capture
 * showing a native-pipeline error) — attachHls() checked native HLS
 * support before hls.js support, backwards from hls.js's own documented
 * order. This fix stays; it's unrelated to the retry-logic saga.
 *
 * D-42: reverted the custom recovery logic back to Phase 1's original,
 * simple policy (2 attempts, no reset, no backoff, no window) — piling
 * more sophistication onto a code path that might not even be the one
 * running helped nothing and only added risk. Added a genuinely new,
 * hls.js-error-taxonomy-independent stall watchdog instead: it directly
 * polls `video.currentTime` and treats "hasn't advanced in 20s while it
 * should be playing" as a fatal error regardless of what hls.js does or
 * doesn't report — targeting what the viewer actually experiences rather
 * than trying to interpret hls.js's internal classification, which four
 * iterations showed to be an unreliable signal for this exact symptom.
 *
 * Mocks hls.js entirely — this only needs to exercise attachHls()'s own
 * branching/event-wiring/counter/timer logic, not real MSE/video playback
 * (matching how upload-film.ts/encode-hls.sh are verified by running them
 * rather than unit tested, for the same reason: nothing here is
 * meaningfully testable without a real browser).
 */
const { instances, startLoadSpy, recoverMediaErrorSpy, destroySpy, isSupportedSpy, FakeHls } = vi.hoisted(() => {
  const instances: FakeHls[] = [];
  const startLoadSpy = vi.fn();
  const recoverMediaErrorSpy = vi.fn();
  const destroySpy = vi.fn();
  const isSupportedSpy = vi.fn(() => true);

  class FakeHls {
    listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    startLoad = startLoadSpy;
    recoverMediaError = recoverMediaErrorSpy;
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = destroySpy;

    static isSupported() {
      return isSupportedSpy();
    }
    static Events = { ERROR: "hlsError" };
    static ErrorTypes = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError", OTHER_ERROR: "otherError" };

    constructor() {
      instances.push(this);
    }

    on(event: string, cb: (...args: unknown[]) => void) {
      const list = this.listeners.get(event) ?? [];
      list.push(cb);
      this.listeners.set(event, list);
    }

    emit(event: string, ...args: unknown[]) {
      for (const cb of this.listeners.get(event) ?? []) cb(...args);
    }
  }

  return { instances, startLoadSpy, recoverMediaErrorSpy, destroySpy, isSupportedSpy, FakeHls };
});

vi.mock("hls.js", () => ({ default: FakeHls, Hls: FakeHls }));

// A real jsdom <video> element (so addEventListener/dispatchEvent/.load()
// all genuinely work, unlike a plain object stub), with canPlayType and
// (for the stall-watchdog tests) paused/ended overridden via
// defineProperty, since those are normally read-only reflections of real
// playback state jsdom doesn't simulate.
function fakeVideo(canPlayType = ""): HTMLVideoElement {
  const video = document.createElement("video");
  video.canPlayType = () => canPlayType as CanPlayTypeResult;
  return video;
}

function setPaused(video: HTMLVideoElement, paused: boolean) {
  Object.defineProperty(video, "paused", { value: paused, configurable: true });
}

function setCurrentTime(video: HTMLVideoElement, time: number) {
  Object.defineProperty(video, "currentTime", { value: time, configurable: true });
}

describe("attachHls", () => {
  beforeEach(() => {
    instances.length = 0;
    startLoadSpy.mockClear();
    recoverMediaErrorSpy.mockClear();
    destroySpy.mockClear();
    isSupportedSpy.mockReset().mockReturnValue(true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("fatal hls.js errors (Phase 1's original, simple policy)", () => {
    it("recovers from a fatal network error by calling startLoad", async () => {
      const { attachHls } = await import("./hls");
      attachHls(fakeVideo(), "master.m3u8", {});

      const hls = instances[0];
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      expect(startLoadSpy).toHaveBeenCalledTimes(1);
    });

    it("recovers from a fatal media error by calling recoverMediaError", async () => {
      const { attachHls } = await import("./hls");
      attachHls(fakeVideo(), "master.m3u8", {});

      const hls = instances[0];
      hls.emit("hlsError", {}, { fatal: true, type: "mediaError" });
      expect(recoverMediaErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("gives up after 2 consecutive fatal errors", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      attachHls(fakeVideo(), "master.m3u8", { onFatalError });

      const hls = instances[0];
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      expect(onFatalError).not.toHaveBeenCalled();

      hls.emit("hlsError", {}, { fatal: true, type: "networkError", details: "fragLoadTimeOut" });
      expect(onFatalError).toHaveBeenCalledWith({ reason: "network", detail: "fragLoadTimeOut" });
    });

    it("calls onFatalError immediately for a fatal error type it doesn't know how to recover from", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      attachHls(fakeVideo(), "master.m3u8", { onFatalError });

      const hls = instances[0];
      const otherError = { fatal: true, type: "otherError", details: "internalException" };
      hls.emit("hlsError", {}, otherError);

      expect(onFatalError).toHaveBeenCalledWith({ reason: "other", detail: "internalException" });
      expect(startLoadSpy).not.toHaveBeenCalled();
      expect(recoverMediaErrorSpy).not.toHaveBeenCalled();
    });

    it("ignores non-fatal errors entirely", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      attachHls(fakeVideo(), "master.m3u8", { onFatalError });

      const hls = instances[0];
      hls.emit("hlsError", {}, { fatal: false, type: "networkError" });

      expect(onFatalError).not.toHaveBeenCalled();
      expect(startLoadSpy).not.toHaveBeenCalled();
    });
  });

  describe("D-42: stall watchdog, independent of hls.js's own error reporting", () => {
    it("reports a stall when currentTime hasn't advanced for the timeout, with no hls.js error involved at all", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo();
      setPaused(video, false);
      setCurrentTime(video, 294);
      attachHls(video, "master.m3u8", { onFatalError });

      // Checks run every 2s; currentTime never changes.
      await vi.advanceTimersByTimeAsync(18_000);
      expect(onFatalError).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(4_000); // crosses the 20s timeout
      expect(onFatalError).toHaveBeenCalledWith({ reason: "stalled", detail: "no progress for 20s" });
    });

    it("does not report a stall while currentTime keeps advancing", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo();
      setPaused(video, false);
      setCurrentTime(video, 100);
      attachHls(video, "master.m3u8", { onFatalError });

      for (let i = 0; i < 20; i++) {
        setCurrentTime(video, 100 + i);
        await vi.advanceTimersByTimeAsync(2_000);
      }
      expect(onFatalError).not.toHaveBeenCalled();
    });

    it("does not report a stall while the video is legitimately paused", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo();
      setPaused(video, true);
      setCurrentTime(video, 294);
      attachHls(video, "master.m3u8", { onFatalError });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(onFatalError).not.toHaveBeenCalled();
    });

    it("stops checking once destroyed, so it can't fire after the player has already been torn down", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo();
      setPaused(video, false);
      setCurrentTime(video, 294);
      const controller = attachHls(video, "master.m3u8", { onFatalError });

      await vi.advanceTimersByTimeAsync(10_000);
      controller.destroy();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(onFatalError).not.toHaveBeenCalled();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("only reports once, not on every check thereafter", async () => {
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo();
      setPaused(video, false);
      setCurrentTime(video, 294);
      attachHls(video, "master.m3u8", { onFatalError });

      await vi.advanceTimersByTimeAsync(60_000);
      expect(onFatalError).toHaveBeenCalledTimes(1);
    });
  });

  describe("D-40: hls.js is preferred over native HLS", () => {
    it("uses hls.js even when the browser also claims native HLS support", async () => {
      const { attachHls } = await import("./hls");
      const video = fakeVideo("probably"); // a non-Safari browser reporting partial native support
      attachHls(video, "master.m3u8", {});

      expect(instances).toHaveLength(1);
      expect(instances[0].loadSource).toHaveBeenCalledWith("master.m3u8");
      expect(instances[0].attachMedia).toHaveBeenCalledWith(video);
      expect(video.getAttribute("src")).toBeNull();
    });

    it("falls back to native HTML5 video only when hls.js genuinely isn't supported", async () => {
      isSupportedSpy.mockReturnValue(false);
      const { attachHls } = await import("./hls");
      const video = fakeVideo("probably");
      attachHls(video, "master.m3u8", {});

      expect(instances).toHaveLength(0);
      expect(video.getAttribute("src")).toBe("master.m3u8");
    });

    it("surfaces an error when neither hls.js nor native HLS is supported", async () => {
      isSupportedSpy.mockReturnValue(false);
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      attachHls(fakeVideo(""), "master.m3u8", { onFatalError });

      expect(instances).toHaveLength(0);
      expect(onFatalError).toHaveBeenCalledWith({
        reason: "other",
        detail: "HLS playback is not supported in this browser",
      });
    });

    it("maps a native MediaError to a FatalPlaybackError with the real detail text", async () => {
      isSupportedSpy.mockReturnValue(false);
      const { attachHls } = await import("./hls");
      const onFatalError = vi.fn();
      const video = fakeVideo("probably");
      attachHls(video, "master.m3u8", { onFatalError });

      Object.defineProperty(video, "error", {
        value: { code: 3, message: "PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE" },
      });
      video.dispatchEvent(new Event("error"));

      expect(onFatalError).toHaveBeenCalledWith({
        reason: "media",
        detail: "PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE",
      });
    });
  });
});
