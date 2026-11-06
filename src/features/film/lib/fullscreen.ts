/**
 * Thin wrapper around the Fullscreen API, used on desktop and Android.
 * iPhone Safari doesn't support requestFullscreen() on arbitrary elements
 * (document.fullscreenEnabled is false there), so this naturally no-ops on
 * iOS — exactly what phases/PHASE-1-entry-to-film.md T11 asks for ("on
 * iPhone use the layer only"), without needing explicit iOS sniffing. It
 * deliberately never calls the iOS-only HTMLVideoElement.webkitEnterFull
 * screen(), which would hand control to the system video player and its
 * own chrome instead of our custom controls.
 */
interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export function isFullscreenSupported(): boolean {
  return typeof document !== "undefined" && Boolean(document.fullscreenEnabled);
}

export async function requestFullscreen(element: HTMLElement): Promise<void> {
  if (!isFullscreenSupported()) return;
  const target = element as WebkitFullscreenElement;
  try {
    if (typeof target.requestFullscreen === "function") {
      await target.requestFullscreen();
    } else if (typeof target.webkitRequestFullscreen === "function") {
      await target.webkitRequestFullscreen();
    }
  } catch {
    // Can be rejected (gesture too stale, user declined, etc.). The CSS
    // fixed/100dvh layer already reads as full-screen either way.
  }
}

export async function exitFullscreenIfActive(): Promise<void> {
  const doc = document as WebkitFullscreenDocument;
  const activeElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  if (!activeElement) return;
  try {
    if (typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === "function") {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Nothing useful to do if the browser refuses to exit.
  }
}
