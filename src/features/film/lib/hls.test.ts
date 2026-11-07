import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for two real production incidents:
 *
 * D-38: attachHls()'s fatal-error recovery counter never used to reset, so
 * two unrelated, individually-recoverable network blips minutes apart (not
 * unusual over this film's real ~9-minute runtime) would exhaust
 * MAX_RECOVERY_ATTEMPTS and surface as an unrecoverable "Playback failed",
 * even though each recovery genuinely worked.
 *
 * D-39: the fix for D-38 alone didn't fully resolve a second real report.
 * Hardened further: a higher retry budget, a short backoff before retrying
 * a network error (hls.js's own internal fragLoadingMaxRetry already tries
 * 6 times over up to 64s before ever escalating to fatal, so hammering
 * immediately rarely helps), and real diagnostic detail (reason/detail)
 * passed to onFatalError instead of an opaque `unknown`, since a
 * screenshot of the resulting UI alone carries no diagnostic value.
 *
 * Mocks hls.js entirely — this only needs to exercise attachHls()'s own
 * event-wiring/counter/timer logic, not real MSE/video playback (matching
 * how upload-film.ts/encode-hls.sh are verified by running them rather
 * than unit tested, for the same reason: nothing here is meaningfully
 * testable without a real browser).
 */
const { instances, startLoadSpy, recoverMediaErrorSpy, destroySpy, FakeHls } = vi.hoisted(() => {
  const instances: FakeHls[] = [];
  const startLoadSpy = vi.fn();
  const recoverMediaErrorSpy = vi.fn();
  const destroySpy = vi.fn();

  class FakeHls {
    listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    startLoad = startLoadSpy;
    recoverMediaError = recoverMediaErrorSpy;
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = destroySpy;

    static isSupported() {
      return true;
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

  return { instances, startLoadSpy, recoverMediaErrorSpy, destroySpy, FakeHls };
});

vi.mock("hls.js", () => ({ default: FakeHls, Hls: FakeHls }));

// isNativeHlsSupported() checks video.canPlayType(...) !== "" — jsdom's
// default returns "", so these tests naturally exercise the hls.js path.
function fakeVideo(): HTMLVideoElement {
  return { canPlayType: () => "" } as unknown as HTMLVideoElement;
}

describe("attachHls", () => {
  beforeEach(() => {
    instances.length = 0;
    startLoadSpy.mockClear();
    recoverMediaErrorSpy.mockClear();
    destroySpy.mockClear();
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

  it("resets the recovery budget after a fragment actually buffers, so two unrelated network blips don't exhaust it", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    // First blip, recovered.
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(startLoadSpy).toHaveBeenCalledTimes(1);
    expect(onFatalError).not.toHaveBeenCalled();

    // Real progress — this is what should reset the budget.
    hls.emit("hlsFragBuffered");

    // A second, unrelated blip minutes later: should also recover, not
    // immediately fail just because it's technically another error ever.
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(startLoadSpy).toHaveBeenCalledTimes(2);
    expect(onFatalError).not.toHaveBeenCalled();
  });

  it("still gives up after MAX_RECOVERY_ATTEMPTS consecutive errors with no progress between them", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    for (let i = 0; i < 4; i++) {
      hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
      await vi.advanceTimersByTimeAsync(2000);
    }
    expect(onFatalError).not.toHaveBeenCalled();

    // 5th consecutive error, no FRAG_BUFFERED in between — budget exhausted.
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
});
