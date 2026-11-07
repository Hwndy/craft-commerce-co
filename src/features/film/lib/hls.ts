import Hls, { type ErrorData } from "hls.js";

/** A fatal playback error, with enough detail to log and to show the owner something more useful than "Playback failed." */
export interface FatalPlaybackError {
  reason: "network" | "media" | "other";
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

const MAX_RECOVERY_ATTEMPTS = 4;
// Errors more than this far apart are treated as unrelated incidents (a
// fresh budget); errors within it share one bounded budget regardless of
// any partial progress in between. Deliberately less than hls.js's own
// internal fragLoadingMaxRetry window (6 attempts over up to 64s, which
// already runs *before* it ever escalates an error to fatal) so two
// genuinely separate incidents — each preceded by up to ~64s of hls.js's
// own internal retrying — reliably land in different windows, while a
// tight, rapidly-recurring failure stays bounded within one.
const RECOVERY_WINDOW_MS = 45_000;
// A short pause before retrying a network error avoids hammering a
// connection that hasn't had a moment to recover yet.
const NETWORK_RETRY_DELAY_MS = 2000;

/**
 * Attaches an HLS source to a <video> element: hls.js (MSE-based) wherever
 * it's supported, the browser's own native HLS only as a fallback where
 * it genuinely isn't — in practice, real Safari/iOS. This order matters
 * and is deliberate (docs/decisions.md D-40): checking native support
 * *first* — this code's original order — is backwards from hls.js's own
 * documented integration pattern, and caused a real production incident.
 * `canPlayType('application/vnd.apple.mpegurl')` can return a non-empty
 * ("maybe"/"probably") answer on some non-Safari Chromium builds (observed
 * via a real browser-console capture: `PipelineStatus::
 * DEMUXER_ERROR_COULD_NOT_PARSE`, a Chromium-internal native-pipeline
 * error, not anything hls.js produces) whose native demuxer then can't
 * actually parse this stream partway through — silently skipping hls.js's
 * much more robust, actively-recovering MSE player entirely. hls.js is
 * tried first now regardless of what `canPlayType` claims, so this class
 * of browser can no longer take the fragile native path at all.
 *
 * Recovers automatically from fatal network/media errors a bounded number
 * of times within a sliding time window, plus a short backoff before
 * retrying a network error (see docs/decisions.md D-38/D-39/D-41 — D-41
 * replaced D-38's unconditional "any progress resets the budget" logic,
 * which could loop forever against a rapidly-recurring error); anything
 * else, or the budget running out, calls onFatalError so the UI can offer
 * a retry. Always logs the real error to the console, since a screenshot
 * of the resulting UI alone (what every incident report so far started
 * as) carries no diagnostic detail on its own.
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
  let recoveryWindowStartedAt = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;

  function giveUp(data: ErrorData) {
    console.error("[film] fatal HLS error, giving up", { type: data.type, details: data.details, reason: data.error });
    const reason: FatalPlaybackError["reason"] =
      data.type === Hls.ErrorTypes.NETWORK_ERROR
        ? "network"
        : data.type === Hls.ErrorTypes.MEDIA_ERROR
          ? "media"
          : "other";
    options.onFatalError?.({ reason, detail: data.details });
  }

  /**
   * Buckets this fatal error into the current recovery window (starting a
   * fresh one, and a fresh budget, if the last error was long enough ago
   * to be unrelated), and returns whether there's still budget left to
   * attempt a recovery.
   *
   * This used to reset the attempt count on every `FRAG_BUFFERED` event
   * instead (any successful buffer = past errors are stale) — but that
   * can never terminate: a *rapidly, repeatedly recurring* media error
   * that buffers one fragment successfully between each recovery attempt
   * resets the budget every single time, looping forever instead of ever
   * reaching `giveUp()` — a real production incident this caused (D-41):
   * the film silently stalled indefinitely, re-fetching the same recent
   * segments on every recovery cycle, with no error ever shown. A
   * time-bounded window still gives isolated, well-spaced blips a fresh
   * budget (hls.js's own events D-38 was written for), while guaranteeing
   * any tight, rapidly-recurring failure still terminates within
   * MAX_RECOVERY_ATTEMPTS and surfaces as a real, retryable error instead
   * of an invisible stall.
   */
  function attemptRecovery(): boolean {
    const now = Date.now();
    if (now - recoveryWindowStartedAt > RECOVERY_WINDOW_MS) {
      recoveryWindowStartedAt = now;
      recoveryAttempts = 0;
    }
    recoveryAttempts += 1;
    return recoveryAttempts <= MAX_RECOVERY_ATTEMPTS;
  }

  hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
    if (!data.fatal) return;
    console.warn("[film] HLS error", { fatal: data.fatal, type: data.type, details: data.details });
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        if (!attemptRecovery()) {
          giveUp(data);
          return;
        }
        retryTimeout = setTimeout(() => hls.startLoad(), NETWORK_RETRY_DELAY_MS);
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        if (!attemptRecovery()) {
          giveUp(data);
          return;
        }
        hls.recoverMediaError();
        break;
      default:
        giveUp(data);
    }
  });

  hls.loadSource(src);
  hls.attachMedia(video);

  return {
    destroy() {
      if (retryTimeout != null) clearTimeout(retryTimeout);
      hls.destroy();
    },
  };
}
