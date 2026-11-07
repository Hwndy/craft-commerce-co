import Hls, { type ErrorData } from "hls.js";

export interface HlsAttachOptions {
  /**
   * Called when hls.js (or the native player) hits an error it can't
   * auto-recover from. The caller should show a retry control that just
   * calls attachHls() again from scratch.
   */
  onFatalError?: (error: unknown) => void;
}

export interface HlsController {
  destroy(): void;
}

export function isNativeHlsSupported(video: HTMLVideoElement): boolean {
  return video.canPlayType("application/vnd.apple.mpegurl") !== "";
}

/**
 * Attaches an HLS source to a <video> element: hls.js where MSE-based HLS
 * is supported, the browser's own native HLS otherwise (Safari/iOS).
 * Recovers automatically from fatal network/media errors a couple of times
 * (hls.js's documented pattern); anything else — or repeated failures —
 * calls onFatalError so the UI can offer a retry.
 */
export function attachHls(
  video: HTMLVideoElement,
  src: string,
  options: HlsAttachOptions = {}
): HlsController {
  if (isNativeHlsSupported(video)) {
    video.src = src;
    const onError = () => options.onFatalError?.(video.error);
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
    options.onFatalError?.(new Error("HLS playback is not supported in this browser"));
    return { destroy() {} };
  }

  const hls = new Hls({ enableWorker: true });
  const MAX_RECOVERY_ATTEMPTS = 2;
  let recoveryAttempts = 0;

  // Without this, two unrelated, individually-recoverable network blips
  // several minutes apart (not unusual over this film's real ~9-minute
  // runtime) exhaust MAX_RECOVERY_ATTEMPTS and surface as an unrecoverable
  // "Playback failed" even though each recovery genuinely worked — a real
  // production incident this caused, found via a real playback failure
  // partway through the film, not by inspection (docs/decisions.md).
  // FRAG_BUFFERED (a fragment actually made it into the buffer) is clear
  // evidence playback is healthy again, so past errors are stale.
  hls.on(Hls.Events.FRAG_BUFFERED, () => {
    recoveryAttempts = 0;
  });

  hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
    if (!data.fatal) return;
    if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
      options.onFatalError?.(data);
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
        options.onFatalError?.(data);
    }
  });

  hls.loadSource(src);
  hls.attachMedia(video);

  return {
    destroy() {
      hls.destroy();
    },
  };
}
