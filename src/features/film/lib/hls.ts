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
// hls.js's own internal fragLoadingMaxRetry (default 6 attempts over up to
// 64s) already runs *before* it ever escalates an error to fatal — by the
// time our own recovery below runs, the network has usually already been
// struggling for a while. A short pause before trying again avoids
// hammering a connection that hasn't had a moment to recover yet.
const NETWORK_RETRY_DELAY_MS = 2000;

/**
 * Attaches an HLS source to a <video> element: hls.js where MSE-based HLS
 * is supported, the browser's own native HLS otherwise (Safari/iOS).
 * Recovers automatically from fatal network/media errors a few times
 * (hls.js's documented pattern, plus a progress-based reset and a short
 * backoff — see docs/decisions.md D-38/D-39); anything else — or repeated
 * failures — calls onFatalError so the UI can offer a retry. Always logs
 * the real error to the console, since a screenshot of the resulting UI
 * alone (what a real incident report has so far looked like) carries no
 * diagnostic detail.
 */
export function attachHls(
  video: HTMLVideoElement,
  src: string,
  options: HlsAttachOptions = {}
): HlsController {
  if (isNativeHlsSupported(video)) {
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

  if (!Hls.isSupported()) {
    options.onFatalError?.({ reason: "other", detail: "HLS playback is not supported in this browser" });
    return { destroy() {} };
  }

  const hls = new Hls({ enableWorker: true });
  let recoveryAttempts = 0;
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

  // Without this, two unrelated, individually-recoverable network blips
  // several minutes apart (not unusual over this film's real ~9-minute
  // runtime) exhaust MAX_RECOVERY_ATTEMPTS and surface as an unrecoverable
  // "Playback failed" even though each recovery genuinely worked — a real
  // production incident this caused, found via a real playback failure
  // partway through the film, not by inspection (docs/decisions.md D-38).
  // FRAG_BUFFERED (a fragment actually made it into the buffer) is clear
  // evidence playback is healthy again, so past errors are stale.
  hls.on(Hls.Events.FRAG_BUFFERED, () => {
    recoveryAttempts = 0;
  });

  hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
    if (!data.fatal) return;
    console.warn("[film] HLS error", { fatal: data.fatal, type: data.type, details: data.details });
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      giveUp(data);
      return;
    }
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        recoveryAttempts += 1;
        retryTimeout = setTimeout(() => hls.startLoad(), NETWORK_RETRY_DELAY_MS);
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        recoveryAttempts += 1;
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
