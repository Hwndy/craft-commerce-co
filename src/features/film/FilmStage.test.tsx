import { fireEvent, render as rtlRender } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "@/canvas/store";
import { cameraForViewpoint, getViewpoint } from "@/canvas/viewpoints";

import { useGateStore } from "./gateStore";
import type { PublishedFilm } from "./lib/queries";

const film: PublishedFilm = {
  id: "film-1",
  title: "Test film",
  version: 1,
  captionsPath: null,
  media: {
    id: "media-1",
    hlsMaster: null,
    posterPath: null,
    spritePath: null,
    spriteMeta: null,
    durationS: null,
  },
};

// A mutable ref, not a fixed closure, so a test can simulate the film
// query still being in flight (`undefined`, TanStack Query's own pending
// value) and later "resolving" — needed for T6's auto-hide effect, which
// must wait for that instant rather than judging a still-`undefined` film
// as "nothing to watch" (found in review, Greptile, PR #3).
const mockFilmData = vi.hoisted(() => ({ current: undefined as PublishedFilm | null | undefined }));
vi.mock("./lib/useFilm", () => ({
  useFilm: () => ({ data: mockFilmData.current }),
}));

const requestFullscreen = vi.fn().mockResolvedValue(undefined);
const exitFullscreenIfActive = vi.fn().mockResolvedValue(undefined);
vi.mock("./lib/fullscreen", () => ({
  requestFullscreen: (...args: unknown[]) => requestFullscreen(...args),
  exitFullscreenIfActive: (...args: unknown[]) => exitFullscreenIfActive(...args),
}));

import { useFilmControllerStore } from "./filmControllerStore";
import { FilmStage } from "./FilmStage";

// FilmStage reads useLocation() (T6: the Continue handler needs the
// current path to know whether to hand off to About/Contact instead of
// the collage) — every render() below needs a Router ancestor as a result,
// same reason ListRegion.test.tsx/Contact.test.tsx already wrap in one.
function render(ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(ui, { wrapper: MemoryRouter });
}

function renderAtPath(path: string, ui: Parameters<typeof rtlRender>[0]) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  });
}

describe("FilmStage", () => {
  beforeEach(() => {
    mockFilmData.current = film;
    useFilmControllerStore.setState({
      videoElement: null,
      isPrimed: false,
      isRevealed: false,
      isAutomaticReveal: false,
      fallback: "play-button",
    });
    useGateStore.setState({
      version: null,
      duration: 0,
      percent: 0,
      isUnlocked: false,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    requestFullscreen.mockClear();
    exitFullscreenIfActive.mockClear();
  });

  function liveRegion(container: HTMLElement) {
    const region = container.querySelector('[aria-live="polite"]');
    expect(region).not.toBeNull();
    return region as HTMLElement;
  }

  // D-50: a screen reader must have already "seen" this element, empty,
  // before its text can ever change to the lock announcement — which
  // means it must exist, and sit outside any aria-hidden ancestor, on
  // this component's very first render, not just once isRevealed flips.
  it("mounts the lock-announcement live region unconditionally, with empty text, before isRevealed ever becomes true", () => {
    const { container } = render(<FilmStage />);
    const region = liveRegion(container);
    expect(region.textContent).toBe("");
    expect(region.closest('[aria-hidden="true"]')).toBeNull();
  });

  it("announces the lock text only once revealed and actually locked, still outside any aria-hidden ancestor", () => {
    const { container } = render(<FilmStage />);

    act(() => {
      useFilmControllerStore.getState().reveal();
    });

    const region = liveRegion(container);
    expect(region.textContent).toBe("Watch once to unlock the gallery");
    expect(region.closest('[aria-hidden="true"]')).toBeNull();

    const pill = container.querySelector('[data-testid="film-lock-pill"]') as HTMLElement;
    expect(pill).toHaveTextContent("Watch once to unlock the gallery");
    expect(pill).toBeVisible();
  });

  it("clears the live region's text (not just visually hides the pill) once unlocked", () => {
    const { container } = render(<FilmStage />);

    act(() => {
      useFilmControllerStore.getState().reveal();
    });
    expect(liveRegion(container).textContent).toBe("Watch once to unlock the gallery");

    act(() => {
      useGateStore.getState().initFor(film.version);
      useGateStore.setState({ isUnlocked: true });
    });

    expect(liveRegion(container).textContent).toBe("");
    const pill = container.querySelector('[data-testid="film-lock-pill"]') as HTMLElement;
    expect(pill).not.toBeVisible();
  });

  it("keeps the rest of the stage's content under aria-hidden while not revealed, unlike the live region", () => {
    const { container } = render(<FilmStage />);
    const video = container.querySelector("video") as HTMLElement;
    expect(video.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  // Regression test for a real finding (found in review, docs/decisions.md
  // D-50): FilmStage is lazy()-loaded separately from Gallery (App.tsx), so
  // on a direct /gallery visit Gallery's reveal() can mutate the shared
  // store before FilmStage's own chunk has even resolved once — meaning
  // isRevealed/isLocked can already be true the very first time FilmStage
  // itself mounts, not just "sometime after" as the other tests above
  // exercise. Simulated here by setting the store before render() rather
  // than after. React Testing Library's render() flushes effects before
  // returning, so this can't observe the literal first-paint DOM (empty) —
  // that guarantee is structural: `lockAnnouncement` is plain useState
  // state, only ever written from a useEffect, which cannot run before the
  // first commit. What this does prove is that the end state is still
  // correct in this scenario, i.e. the effect-based rewiring doesn't leave
  // the announcement stuck empty when isLocked was already true at mount.
  it("still announces the lock correctly even when isRevealed/isLocked are already true the first time it mounts", () => {
    useFilmControllerStore.setState({ isRevealed: true });
    const { container } = render(<FilmStage />);
    expect(liveRegion(container).textContent).toBe("Watch once to unlock the gallery");
  });

  // Found via a real, reproducible e2e failure: an already-unlocked visit
  // (a deep link straight into the Board/Shop) still called reveal() —
  // requesting Fullscreen API on stageRef regardless made stageRef the
  // browser's actual top-layer element, which silently swallows every
  // click outside its own subtree (a Dialog portaled to body included,
  // whatever its own CSS z-index), reproduced directly via
  // document.elementFromPoint before this fix.
  describe("Fullscreen API", () => {
    it("requests fullscreen when revealed while the film genuinely needs watching (locked)", () => {
      render(<FilmStage />);
      expect(requestFullscreen).not.toHaveBeenCalled();

      act(() => {
        useFilmControllerStore.getState().reveal();
      });

      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it("does not request fullscreen when revealed but already unlocked (e.g. a deep link visit)", () => {
      useGateStore.setState({ version: 1, isUnlocked: true });
      render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().reveal();
      });

      expect(requestFullscreen).not.toHaveBeenCalled();
    });

    it("exits fullscreen once isRevealed goes back to false (Continue, or leaving /gallery)", () => {
      render(<FilmStage />);
      act(() => {
        useFilmControllerStore.getState().reveal();
      });
      expect(requestFullscreen).toHaveBeenCalledTimes(1);

      act(() => {
        useFilmControllerStore.getState().hide();
      });
      expect(exitFullscreenIfActive).toHaveBeenCalled();
    });
  });

  // T6 (found via a real, reproducible e2e failure, then two more real
  // gaps found in review on the first attempt at fixing it — Greptile,
  // PR #3): Gallery.tsx's own revealAutomatically() runs unconditionally
  // on every mount (T10/D-07) — a second, already-unlocked navigation
  // straight into /gallery/contact (or any board content with nothing
  // elevating it above FilmStage, unlike ProductOverlay's own Dialog)
  // left the full-screen, fully-interactive revealed layer sitting on
  // top of it, since nothing ever dismissed it once it turned out not to
  // need watching.
  describe("auto-hide when automatically revealed but not locked", () => {
    it("hides itself once it's clear an automatic reveal doesn't need watching (already unlocked)", () => {
      useGateStore.setState({ version: 1, isUnlocked: true });
      render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(false);
    });

    it("hides itself when there is no film at all (data: null, not just not-yet-loaded)", () => {
      mockFilmData.current = null;
      render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(false);
    });

    // The gate's own saved unlock is only read once film.version arrives
    // (gateInitFor, above) — a returning visitor's isUnlocked can still
    // read false for an instant while the film query is in flight. A
    // first attempt at this fix was a one-shot effect keyed only on
    // isRevealed, so it decided (wrongly) in that instant and never got
    // another chance once the real data arrived (found in review,
    // Greptile, PR #3).
    it("waits for the film query to settle before deciding, rather than judging a still-loading film as needing to stay revealed", () => {
      mockFilmData.current = undefined; // still loading
      useGateStore.setState({ version: 1, isUnlocked: true }); // a returning, already-unlocked visitor
      const { rerender } = render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });
      // Still waiting on film — must not have given up and stayed revealed forever.
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);

      // The query resolves — mockFilmData itself isn't reactive state React
      // would notice changed on its own, so force the re-render a real
      // useFilm() data update would have caused.
      mockFilmData.current = film;
      act(() => {
        rerender(<FilmStage />);
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(false);
    });

    // A second real CI failure on an earlier attempt at this exact fix,
    // distinct from the test above: gateInitFor's own effect (declared
    // earlier in FilmStage, so it runs first) synchronously corrects the
    // gate store's real isUnlocked value the instant film.version first
    // becomes known — in the very same commit the auto-hide effect also
    // sees film become non-null in. A version of the auto-hide effect
    // that read the React-subscribed `isUnlocked` (this same render's
    // now-stale closure, captured before either effect ran) rather than
    // the live store value saw a false "locked" reading for exactly one
    // render — and because that reading was also latched permanently (to
    // protect the mid-watch-unlock case the test below covers), the false
    // reading stuck forever instead of self-correcting. version starts at
    // null (not an already-initialized 1) specifically so gateInitFor's
    // own effect genuinely fires for the first time in the same commit,
    // matching the real sequence instead of skipping it.
    it("reads the gate's real, corrected isUnlocked even when gateInitFor's own effect first runs in the very same commit film resolves", () => {
      window.localStorage.setItem(`alllife:film:${film.version}:unlocked`, "true");
      mockFilmData.current = undefined;
      useGateStore.setState({ version: null, isUnlocked: false });
      const { rerender } = render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);

      mockFilmData.current = film;
      act(() => {
        rerender(<FilmStage />);
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(false);
    });

    // The counterpart: an explicit, visitor-requested reveal (the Gallery
    // board card, Replay) must never be silently cancelled just because
    // the gate happens to already be unlocked — a first attempt at this
    // fix couldn't tell an automatic reveal apart from an explicit one
    // and broke re-watching (found in review, Greptile, PR #3).
    it("never auto-hides an explicit reveal, even when already unlocked", () => {
      useGateStore.setState({ version: 1, isUnlocked: true });
      render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().reveal();
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(true);
    });

    // The other counterpart: a visitor who genuinely needs to watch
    // (locked at reveal) must reach the deliberate Replay/Continue screen
    // — watching through mid-playback (isUnlocked flipping true while
    // still revealed) must not itself trigger this same auto-hide early.
    it("does not auto-hide a visitor who is actually locked, even once they finish watching", () => {
      render(<FilmStage />);
      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);

      act(() => {
        useGateStore.setState({ isUnlocked: true });
      });
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);
    });

    // hide() alone only ever changed isRevealed — never responsible for
    // pausing playback before, since by the time Continue is clickable
    // the film has already ended on its own. This auto-hide path is the
    // first time hide() can fire while the video might genuinely still
    // be playing (found in review, Greptile, PR #3).
    it("pauses any playback the separate start() effect may already have begun", () => {
      const pause = vi.fn();
      useGateStore.setState({ version: 1, isUnlocked: true });
      const { container } = render(<FilmStage />);
      const video = container.querySelector("video") as HTMLVideoElement;
      video.pause = pause;

      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });

      expect(pause).toHaveBeenCalled();
    });
  });

  // Found in review (CodeRabbit, PR #3): the board never updates the URL as
  // the camera pans (onOpenProduct/onOpenPhoto are the only navigate()
  // calls — panning the board to a region card is not one of them), so
  // location.pathname alone can't tell an about-to-rewatch visitor's
  // *current* intent apart from wherever they happened to land originally.
  describe("Continue's About/Contact handoff", () => {
    function endTheFilm(container: HTMLElement) {
      useGateStore.setState({ version: 1, isUnlocked: true });
      const video = container.querySelector("video") as HTMLVideoElement;
      act(() => {
        video.dispatchEvent(new Event("ended"));
      });
    }

    afterEach(() => {
      useCameraStore.setState({ camera: { x: 0, y: 0, zoom: 1 }, viewport: { width: 0, height: 0 }, isFlying: false });
    });

    it("honours the URL for an automatic (deep-link) reveal of /gallery/contact", () => {
      const { container, getByRole } = renderAtPath("/gallery/contact", <FilmStage />);
      act(() => {
        useFilmControllerStore.getState().revealAutomatically();
      });
      endTheFilm(container);

      const flyTo = vi.spyOn(useCameraStore.getState(), "flyTo");
      act(() => {
        fireEvent.click(getByRole("button", { name: "Continue" }));
      });

      expect(flyTo).toHaveBeenCalledWith(
        cameraForViewpoint(getViewpoint("contact"), useCameraStore.getState().viewport),
        expect.anything()
      );
    });

    // The bug itself: an explicit rewatch (not a fresh deep-link reveal)
    // triggered from Gallery's own "watch" card, while the URL still
    // happens to read /gallery/contact from the original deep link, must
    // still hand off to the collage like every other explicit rewatch —
    // not fly the visitor straight back to Contact.
    it("hands off to the collage for an explicit rewatch, even with a stale /gallery/contact URL", () => {
      const { container, getByRole } = renderAtPath("/gallery/contact", <FilmStage />);
      act(() => {
        useFilmControllerStore.getState().reveal();
      });
      endTheFilm(container);

      const flyTo = vi.spyOn(useCameraStore.getState(), "flyTo");
      act(() => {
        fireEvent.click(getByRole("button", { name: "Continue" }));
      });

      expect(flyTo).toHaveBeenCalledWith(
        cameraForViewpoint(getViewpoint("collage"), useCameraStore.getState().viewport),
        expect.anything()
      );
    });
  });
});
