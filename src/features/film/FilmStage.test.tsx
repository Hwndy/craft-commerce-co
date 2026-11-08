import { render } from "@testing-library/react";
import { act } from "react";
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

import { useFilmControllerStore } from "./filmControllerStore";
import { FilmStage } from "./FilmStage";

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
});
