import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearViewpointsCache, setViewpointsCache } from "@/canvas/viewpoints";

import ListIndex from "./ListIndex";

// useViewpointsQuery() calls the real fetchViewpoints(), which hits
// supabase-js — mocked here so the test exercises the real reactive path
// (query resolves -> component re-renders with the fetched data) rather
// than only the synchronous fallback, which is exactly the path a real
// regression (the stale-fallback-forever bug this test file originally
// caught) would hide. vi.mock's factory is hoisted above this file's own
// top-level consts, so the shared fixture has to go through vi.hoisted.
const { viewpoints } = vi.hoisted(() => ({
  viewpoints: [
    { key: "landing", label: "Landing", x: 0, y: 0, zoom: 1, sortOrder: 0, inGuidedPath: true },
    { key: "gallery", label: "Gallery", x: 2000, y: 0, zoom: 1, sortOrder: 1, inGuidedPath: true },
    { key: "shop", label: "Shop", x: -2000, y: 0, zoom: 1, sortOrder: 2, inGuidedPath: true },
  ],
}));

vi.mock("@/canvas/lib/queries", () => ({
  VIEWPOINTS_QUERY_KEY: ["viewpoints"],
  fetchViewpoints: vi.fn().mockResolvedValue(viewpoints),
}));

function renderIndex() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ListIndex />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Seeds only the synchronous fallback the component briefly shows before
  // the mocked query above resolves — intentionally a *different* list
  // (just landing/gallery) so the two code paths aren't accidentally
  // indistinguishable in this test.
  setViewpointsCache([viewpoints[0], viewpoints[1]]);
});

afterEach(() => {
  clearViewpointsCache();
});

describe("ListIndex", () => {
  it("lists every region from the real query as a link, in order, once it resolves", async () => {
    renderIndex();

    await waitFor(() => {
      const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/list/"));
      expect(links.map((link) => link.textContent)).toEqual(["Landing", "Gallery", "Shop"]);
    });
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/list/"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/list/landing", "/list/gallery", "/list/shop"]);
  });

  it("links back to the spatial view", async () => {
    renderIndex();
    await waitFor(() => expect(screen.getAllByRole("link").length).toBeGreaterThan(0));
    expect(screen.getByRole("link", { name: "Back to the spatial view" })).toHaveAttribute("href", "/");
  });
});
