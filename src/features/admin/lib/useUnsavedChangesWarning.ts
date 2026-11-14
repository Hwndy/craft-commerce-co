import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export interface UseUnsavedChangesWarningResult {
  /** Navigates immediately if clean; if dirty, confirms with the owner first (confirmIfDirty()). */
  guardedNavigate: (to: string) => void;
  /** !isDirty, or a window.confirm the owner must accept to proceed. */
  confirmIfDirty: () => boolean;
}

/**
 * T3's "unsaved-changes warning" primitive, built for App.tsx's plain
 * <BrowserRouter> — React Router's own useBlocker needs a data router
 * (createBrowserRouter), which this app doesn't use and migrating to is
 * out of scope here. Covers the two real cases that don't need one:
 *
 * - Tab close/refresh/external navigation: window.onbeforeunload, wired
 *   while isDirty is true (the browser's own "leave site?" prompt).
 * - In-app navigation a consuming page triggers itself (closing an
 *   AdminEditDrawer with unsaved edits, switching sections): call
 *   guardedNavigate(to) instead of navigate(to) directly.
 *
 * Known gap, left as a gap rather than guessed around: a browser
 * Back/Forward press can't be intercepted this way — only useBlocker (or
 * a full router migration) can do that, and T3's brief doesn't call for
 * one just for this.
 */
export function useUnsavedChangesWarning(isDirty: boolean): UseUnsavedChangesWarningResult {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function confirmIfDirty(): boolean {
    return !isDirty || window.confirm("You have unsaved changes. Discard them?");
  }

  function guardedNavigate(to: string): void {
    if (confirmIfDirty()) navigate(to);
  }

  return { guardedNavigate, confirmIfDirty };
}
