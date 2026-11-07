import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression test for a real production incident: attachHls()'s fatal-
 * error recovery counter never used to reset, so two unrelated,
 * individually-recoverable network blips minutes apart (not unusual over
 * this film's real ~9-minute runtime) would exhaust MAX_RECOVERY_ATTEMPTS
 * and surface as an unrecoverable "Playback failed", even though each
 * recovery genuinely worked. Mocks hls.js entirely — this only needs to
 * exercise attachHls()'s own event-wiring/counter logic, not real
 * MSE/video playback (matching how upload-film.ts/encode-hls.sh are
 * verified by running them rather than unit tested, for the same reason:
 * nothing here is meaningfully testable without a real browser).
 */
const { instances, startLoadSpy, recoverMediaErrorSpy, FakeHls } = vi.hoisted(() => {
  const instances: FakeHls[] = [];
  const startLoadSpy = vi.fn();
  const recoverMediaErrorSpy = vi.fn();

  class FakeHls {
    listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    startLoad = startLoadSpy;
    recoverMediaError = recoverMediaErrorSpy;
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();

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

  return { instances, startLoadSpy, recoverMediaErrorSpy, FakeHls };
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
  });

  it("resets the recovery budget after a fragment actually buffers, so two unrelated network blips don't exhaust it", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    // First blip, recovered.
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    expect(startLoadSpy).toHaveBeenCalledTimes(1);
    expect(onFatalError).not.toHaveBeenCalled();

    // Real progress — this is what should reset the budget.
    hls.emit("hlsFragBuffered");

    // A second, unrelated blip minutes later: should also recover, not
    // immediately fail just because it's technically the "2nd" error ever.
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    expect(startLoadSpy).toHaveBeenCalledTimes(2);
    expect(onFatalError).not.toHaveBeenCalled();
  });

  it("still gives up after MAX_RECOVERY_ATTEMPTS consecutive errors with no progress between them", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];

    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    hls.emit("hlsError", {}, { fatal: true, type: "networkError" });
    expect(onFatalError).not.toHaveBeenCalled();

    // Third consecutive error, no FRAG_BUFFERED in between — budget exhausted.
    const thirdError = { fatal: true, type: "networkError" };
    hls.emit("hlsError", {}, thirdError);
    expect(onFatalError).toHaveBeenCalledWith(thirdError);
  });

  it("calls onFatalError immediately for a fatal error type it doesn't know how to recover from", async () => {
    const { attachHls } = await import("./hls");
    const onFatalError = vi.fn();
    attachHls(fakeVideo(), "master.m3u8", { onFatalError });

    const hls = instances[0];
    const otherError = { fatal: true, type: "otherError" };
    hls.emit("hlsError", {}, otherError);

    expect(onFatalError).toHaveBeenCalledWith(otherError);
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
