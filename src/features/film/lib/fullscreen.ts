/**
 * Thin wrapper around the Fullscreen API, used on desktop and Android.
 * iPhone Safari doesn't support requestFullscreen() on arbitrary elements
 * (document.fullscreenEnabled is false there), so this naturally no-ops on
 * iOS — exactly what phases/PHASE-1-entry-to-film.md T11 asks for ("on
 * iPhone use the layer only"), without needing explicit iOS sniffing. It
 * deliberately never calls the iOS-only HTMLVideoElement.webkitEnterFull
 * screen(), which would hand control to the system video player and its
 * own chrome instead of our custom controls.
 *
 * Client feedback (docs/decisions.md D-71): "rotate screen to landscape
 * mode and watch... without seeing tab list" — once fullscreen, also
 * tries screen.orientation.lock("landscape"). This combination (Fullscreen
 * API + orientation lock) is an Android Chrome capability specifically;
 * iOS Safari has no orientation-lock API at all (not a bug here to work
 * around — a real, documented platform limitation), and since
 * requestFullscreen() already no-ops there, the lock attempt below never
 * even runs. Needs a real-device check on Android (and confirming iPhone
 * still behaves acceptably without it) before calling this done.
 */
interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface LockableScreenOrientation extends ScreenOrientation {
  lock?: (orientation: "landscape" | "portrait") => Promise<void>;
}

async function lockLandscapeOrientation(): Promise<void> {
  const orientation = typeof screen !== "undefined" ? (screen.orientation as LockableScreenOrientation) : undefined;
  if (!orientation || typeof orientation.lock !== "function") return;
  try {
    await orientation.lock("landscape");
  } catch {
    // Not supported (iOS Safari has no such API at all) or refused —
    // the fixed/100dvh fullscreen layer already works in portrait too.
  }
}

function unlockOrientation(): void {
  const orientation = typeof screen !== "undefined" ? screen.orientation : undefined;
  if (!orientation || typeof orientation.unlock !== "function") return;
  try {
    orientation.unlock();
  } catch {
    // Nothing useful to do if the browser refuses.
  }
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
    return;
  }
  await lockLandscapeOrientation();
}

export async function exitFullscreenIfActive(): Promise<void> {
  const doc = document as WebkitFullscreenDocument;
  const activeElement = doc.fullscreenElement ?? doc.webkitFullscreenElement;
  if (!activeElement) return;
  unlockOrientation();
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
