import Hls, { type ErrorData } from "hls.js";

/** A fatal playback error, with enough detail to log and to show the owner something more useful than "Playback failed." */
export interface FatalPlaybackError {
  reason: "network" | "media" | "stalled" | "other";
  detail?: string;
}

export interface HlsAttachOptions {
  /**
   * Called when hls.js (or the native player) hits an error it can't
   * auto-recover from. The caller should show a retry control that just
   * calls attachHls() again from scratch.
   */
  onFatalError?: (error: FatalPlaybackError) => void;
}

export interface HlsController {
  destroy(): void;
}

export function isNativeHlsSupported(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/** MediaError.code per the spec (1 ABORTED, 2 NETWORK, 3 DECODE, 4 SRC_NOT_SUPPORTED). */
function reasonForNativeMediaError(error: MediaError | null): FatalPlaybackError {
  switch (error?.code) {
    case 2:
      return { reason: "network", detail: error.message || undefined };
    case 3:
    case 4:
      return { reason: "media", detail: error.message || undefined };
    default:
      return { reason: "other", detail: error?.message || undefined };
  }
}

// Deliberately back to Phase 1's original, simple policy (2 attempts, no
// reset, no backoff, no sliding window) — see docs/decisions.md D-42. Three
// rounds of increasingly elaborate retry logic (D-38/D-39/D-41) never
// actually fixed the real production symptom, and a 4th report showed why:
// every repeated segment request was a 304 (succeeding, served from
// cache), meaning hls.js may never have been raising the `fatal` errors
// this logic reacts to in the first place. Piling more retry sophistication
// onto a code path that might not even be the one running helps nothing
// and only adds risk — simplest-that-matches-hls.js's-own-documented-
// pattern is the right baseline until there's real evidence pointing
// at something more specific.
const MAX_RECOVERY_ATTEMPTS = 2;

// What actually matters to a viewer is whether the video is advancing —
// not how hls.js internally classifies whatever is or isn't happening.
// This watchdog is deliberately independent of hls.js's error events:
// it directly polls `video.currentTime` and, if playback should be
// progressing but hasn't moved in STALL_TIMEOUT_MS, treats that as a
// fatal error regardless of whether hls.js ever reported one. See
// docs/decisions.md D-42.
const STALL_TIMEOUT_MS = 20_000;
const STALL_CHECK_INTERVAL_MS = 2_000;

/**
 * Attaches an HLS source to a <video> element: hls.js (MSE-based) wherever
 * it's supported, the browser's own native HLS only as a fallback where
 * it genuinely isn't — in practice, real Safari/iOS. This order matters
 * and is deliberate (docs/decisions.md D-40): checking native support
 * *first* is backwards from hls.js's own documented integration pattern,
 * and caused a real production incident (`canPlayType` can return a
 * non-empty answer on some non-Safari Chromium builds whose native
 * demuxer then can't actually parse this stream).
 *
 * Recovers automatically from a couple of fatal network/media errors
 * (hls.js's own documented minimal pattern); anything else, or repeated
 * failures, calls onFatalError. A separate, hls.js-error-agnostic stall
 * watchdog (above) catches the case where playback simply stops
 * advancing without hls.js ever raising a fatal error for it. Always logs
 * the real error to the console, since a screenshot of the resulting UI
 * alone (what every incident report so far started as) carries no
 * diagnostic detail on its own.
 */
export function attachHls(
  video: HTMLVideoElement,
  src: string,
  options: HlsAttachOptions = {}
): HlsController {
  if (!Hls.isSupported()) {
    if (!isNativeHlsSupported(video)) {
      options.onFatalError?.({ reason: "other", detail: "HLS playback is not supported in this browser" });
      return { destroy() {} };
    }
    const onError = () => {
      const fatal = reasonForNativeMediaError(video.error);
      console.error("[film] fatal playback error (native HLS)", video.error);
      options.onFatalError?.(fatal);
    };
    video.src = src;
    video.addEventListener("error", onError);
    return {
      destroy() {
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      },
    };
  }

  const hls = new Hls({ enableWorker: true });
  let recoveryAttempts = 0;
  let stopped = false;

  function giveUp(error: FatalPlaybackError) {
    stopped = true;
    console.error("[film] fatal playback error, giving up", error);
    options.onFatalError?.(error);
  }

  hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
    if (!data.fatal) return;
    console.warn("[film] HLS error", { fatal: data.fatal, type: data.type, details: data.details });
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      const reason: FatalPlaybackError["reason"] =
        data.type === Hls.ErrorTypes.NETWORK_ERROR
          ? "network"
          : data.type === Hls.ErrorTypes.MEDIA_ERROR
            ? "media"
            : "other";
      giveUp({ reason, detail: data.details });
      return;
    }
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        recoveryAttempts += 1;
        hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        recoveryAttempts += 1;
        hls.recoverMediaError();
        break;
      default:
        giveUp({ reason: "other", detail: data.details });
    }
  });

  let lastCurrentTime = -1;
  let lastProgressAt = Date.now();
  const stallTimer = setInterval(() => {
    if (stopped) return;
    // Not expected to be advancing right now — not a stall.
    if (video.paused || video.ended || video.seeking) {
      lastProgressAt = Date.now();
      lastCurrentTime = video.currentTime;
      return;
    }
    if (video.currentTime !== lastCurrentTime) {
      lastCurrentTime = video.currentTime;
      lastProgressAt = Date.now();
      return;
    }
    if (Date.now() - lastProgressAt >= STALL_TIMEOUT_MS) {
      giveUp({ reason: "stalled", detail: `no progress for ${Math.round(STALL_TIMEOUT_MS / 1000)}s` });
    }
  }, STALL_CHECK_INTERVAL_MS);

  hls.loadSource(src);
  hls.attachMedia(video);

  return {
    destroy() {
      stopped = true;
      clearInterval(stallTimer);
      hls.destroy();
    },
  };
}
