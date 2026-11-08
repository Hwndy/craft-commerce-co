import { render as rtlRender } from "@testing-library/react";
import { act } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("./lib/useFilm", () => ({
  useFilm: () => ({ data: film }),
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

describe("FilmStage", () => {
  beforeEach(() => {
    useFilmControllerStore.setState({
      videoElement: null,
      isPrimed: false,
      isRevealed: false,
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

    // T6 (found via a real, reproducible e2e failure): Gallery.tsx's own
    // reveal() runs unconditionally on every mount — a second, already-
    // unlocked navigation straight into /gallery/contact (or any board
    // content with nothing elevating it above FilmStage, unlike
    // ProductOverlay's own Dialog) left the full-screen, fully-interactive
    // revealed layer sitting on top of it, since nothing ever dismissed it
    // once it turned out not to need watching.
    it("auto-hides itself when revealed but already unlocked, instead of leaving a full-screen layer over the board", () => {
      useGateStore.setState({ version: 1, isUnlocked: true });
      render(<FilmStage />);

      act(() => {
        useFilmControllerStore.getState().reveal();
      });

      expect(useFilmControllerStore.getState().isRevealed).toBe(false);
    });

    // The counterpart: a visitor who genuinely needs to watch (locked at
    // reveal) must reach the deliberate Replay/Continue screen — watching
    // through mid-playback (isUnlocked flipping true while still revealed)
    // must not itself trigger this same auto-hide early.
    it("does not auto-hide a visitor who is actually locked, even once they finish watching", () => {
      render(<FilmStage />);
      act(() => {
        useFilmControllerStore.getState().reveal();
      });
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);

      act(() => {
        useGateStore.setState({ isUnlocked: true });
      });
      expect(useFilmControllerStore.getState().isRevealed).toBe(true);
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
});
