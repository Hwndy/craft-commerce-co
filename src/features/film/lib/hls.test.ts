import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for three real production incidents, in order:
 *
 * D-38: attachHls()'s fatal-error recovery counter never used to reset, so
 * two unrelated, individually-recoverable network blips minutes apart (not
 * unusual over this film's real ~9-minute runtime) would exhaust
 * MAX_RECOVERY_ATTEMPTS and surface as an unrecoverable "Playback failed",
 * even though each recovery genuinely worked.
 *
 * D-39: the fix for D-38 alone didn't fully resolve a second real report.
 * Hardened further: a higher retry budget, a short backoff before retrying
 * a network error, and real diagnostic detail (reason/detail) passed to
 * onFatalError instead of an opaque `unknown`.
 *
 * D-40: the real root cause, found only once a third report came with an
 * actual browser-console error (`PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE`
 * — a Chromium-internal native-pipeline error, not anything hls.js
 * produces): attachHls() checked native HLS support *before* hls.js
 * support, so a non-Safari Chromium build whose `canPlayType` happened to
 * report partial native HLS support took the fragile native `video.src =`
 * path and skipped hls.js — and every retry/backoff fix in D-38/D-39 was
 * dead code for that browser, since it never ran the hls.js branch at
 * all. Fixed by checking `Hls.isSupported()` first, matching hls.js's own
 * documented integration order; native is now only a fallback for when
 * hls.js genuinely isn't supported (in practice, real Safari/iOS).
 *
 * D-41: D-40 routed the reporting browser through hls.js for the first
 * time, which surfaced a latent bug in D-38's own fix: resetting the
 * recovery budget on *any* `FRAG_BUFFERED` event can never terminate
 * against a rapidly, repeatedly recurring media error that buffers one
 * fragment successfully between each recovery — the budget resets every
 * time, looping forever instead of ever reaching `giveUp()`. A fourth
 * real report showed exactly this: no crash, just an endless silent
 * stall, the same recent segments re-fetched (cheap 304s) on every
 * recovery cycle. Replaced the unconditional reset with a time-bounded
 * sliding window: errors more than RECOVERY_WINDOW_MS apart still get a
 * fresh budget (isolated, well-spaced blips — D-38's original intent),
 * but anything recurring faster than that is guaranteed to exhaust
 * MAX_RECOVERY_ATTEMPTS and surface as a real, retryable error instead of
 * an invisible infinite stall.
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
    static Events = { ERROR: "hlsError", FRAG_BUFFERED: "hlsFragBuffered" };
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

// A real jsdom <video> element (so .src/.load()/addEventListener/
// dispatchEvent all genuinely work, unlike a plain object stub), with
// canPlayType overridden — "" means no native support, which is what
// most of these tests want, relying on isSupportedSpy (default true) to
// exercise the hls.js path. The D-40 tests below override both
// independently.
function fakeVideo(canPlayType = ""): HTMLVideoElement {
  const video = document.createElement("video");
  video.canPlayType = () => canPlayType as CanPlayTypeResult;
  return video;
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

  it("retries a fatal network error after a short delay, not immediately", async () => {
    const { attachHls } = await import("./hls");
    attachHls(fakeVideo(), "master.m3u8", {});

    const hls = instances[0];
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    expect(startLoadSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2000);
    expect(startLoadSpy).toHaveBeenCalledTimes(1);
  });

  it("gives a fresh budget to errors that are far enough apart to be unrelated incidents", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    // Five blips total — more than MAX_RECOVERY_ATTEMPTS (4) — but each
    // one more than RECOVERY_WINDOW_MS apart, so none of them should ever
    // exhaust a shared budget; each lands in its own fresh window.
    for (let i = 0; i < 5; i++) {
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      await vi.advanceTimersByTimeAsync(2000); // the retry itself
      await vi.advanceTimersByTimeAsync(60_000); // longer than RECOVERY_WINDOW_MS
    }

    expect(startLoadSpy).toHaveBeenCalledTimes(5);
    expect(onFatalError).not.toHaveBeenCalled();
  });

  it("D-41: never loops forever — a rapidly recurring media error still terminates within the bounded window, even though hls.js genuinely recovers each time", async () => {
    // This reproduces the real incident directly: D-38's original fix
    // reset the budget on *any* FRAG_BUFFERED event, so a media error
    // that recovers (buffers a fragment) and then recurs almost
    // immediately — exactly what a real stuck-film report looked like —
    // never ran out of budget and never called onFatalError. There's no
    // FRAG_BUFFERED listener left to even emit against; the fix is that
    // attempts within one window are bounded regardless of what happens
    // between them.
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    // MAX_RECOVERY_ATTEMPTS (4) recoveries, each only a second apart —
    // well within RECOVERY_WINDOW_MS, simulating the rapid recurrence.
    for (let i = 0; i < 4; i++) {
      hls.emit("hlsError", {}, { fatal: true, type: "mediaError" });
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(recoverMediaErrorSpy).toHaveBeenCalledTimes(4);
    expect(onFatalError).not.toHaveBeenCalled();

    // The 5th recurrence within the same window must terminate the loop.
    hls.emit("hlsError", {}, { fatal: true, type: "mediaError", details: "bufferStalledError" });
    expect(onFatalError).toHaveBeenCalledWith({ reason: "media", detail: "bufferStalledError" });
    // No 5th recovery attempt — it gave up instead of looping again.
    expect(recoverMediaErrorSpy).toHaveBeenCalledTimes(4);
  });

  it("still gives up after MAX_RECOVERY_ATTEMPTS consecutive errors within one window", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    for (let i = 0; i < 4; i++) {
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(onFatalError).not.toHaveBeenCalled();

    // 5th error within the same window — budget exhausted.
    hls.emit("hlsError", {}, { fatal: true, type: "networkError", details: "fragLoadTimeOut" });
    expect(onFatalError).toHaveBeenCalledWith({ reason: "network", detail: "fragLoadTimeOut" });
  });

  it("maps media errors to reason 'media' and other fatal types to 'other', recovering media errors first", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];
    hls.emit("hlsError", {}, { fatal: true, type: "mediaError", details: "bufferAppendError" });
    expect(recoverMediaErrorSpy).toHaveBeenCalledTimes(1);
    expect(onFatalError).not.toHaveBeenCalled();

    const otherError = { fatal: true, type: "otherError", details: "internalException" };
    hls.emit("hlsError", {}, otherError);
    expect(onFatalError).toHaveBeenCalledWith({ reason: "other", detail: "internalException" });
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

  it("cancels a pending retry when destroyed, so it never calls startLoad on an already-torn-down instance", async () => {
    const { attachHls } = await import("./hls");
    const controller = attachHls(fakeVideo(), "master.m3u8", {});

    const hls = instances[0];
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    controller.destroy();

    await vi.advanceTimersByTimeAsync(2000);
    expect(startLoadSpy).not.toHaveBeenCalled();
    expect(destroySpy).toHaveBeenCalledTimes(1);
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
