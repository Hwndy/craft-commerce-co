import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestFullscreen = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/film/lib/fullscreen", () => ({
  requestFullscreen: (...args: unknown[]) => requestFullscreen(...args),
}));

// Real network/Supabase calls aren't available here — this is best-effort
// preloading (preload.ts's own comment), irrelevant to what this test
// checks, so a no-op stub is enough.
vi.mock("@/features/entry/preload", () => ({
  preloadFilmAssets: vi.fn().mockResolvedValue(undefined),
}));

import LandingVideo from "./LandingVideo";

function renderLanding() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingVideo />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LandingVideo", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    requestFullscreen.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // docs/decisions.md D-74: real browsers require the Fullscreen API to be
  // requested within a fresh user gesture — FilmStage.tsx's own
  // isRevealed-driven request fires seconds later, from an async `ended`/
  // timer callback, well outside that window. This must happen here,
  // synchronously inside the actual click, to land the film full screen
  // on arrival (FR-2.1) on a real device rather than silently no-oping.
  it("requests fullscreen on document.documentElement synchronously within the click gesture", async () => {
    renderLanding();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter ALL LIFE" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(requestFullscreen).toHaveBeenCalledWith(document.documentElement);
  });

  it("does not request fullscreen again on a second click (already started)", async () => {
    renderLanding();
    const user = userEvent.setup();
    const enter = screen.getByRole("button", { name: "Enter ALL LIFE" });

    await user.click(enter);
    await user.click(enter);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
