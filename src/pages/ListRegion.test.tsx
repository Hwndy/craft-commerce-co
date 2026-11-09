import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearViewpointsCache, setViewpointsCache } from "@/canvas/viewpoints";

import ListRegion from "./ListRegion";

const { viewpoints, photos, filmRow, nodes } = vi.hoisted(() => ({
  viewpoints: [
    { key: "collage", label: "Collage", x: 2000, y: 1200, zoom: 1, sortOrder: 2, inGuidedPath: true },
    { key: "shop", label: "Shop", x: -2000, y: 0, zoom: 1, sortOrder: 3, inGuidedPath: true },
  ],
  photos: [
    {
      id: "photo-1",
      title: "The first cast",
      takenOn: "2026-03-14",
      media: { id: "m1", width: 2000, height: 1500, blurDataUrl: null, renditions: {} },
    },
  ],
  filmRow: null,
  nodes: [{ id: "node-1", nodeType: "region-label", refTable: null, refId: null }],
}));

vi.mock("@/canvas/lib/queries", () => ({
  VIEWPOINTS_QUERY_KEY: ["viewpoints"],
  fetchViewpoints: vi.fn().mockResolvedValue(viewpoints),
}));
vi.mock("@/features/collage/lib/queries", () => ({
  COLLAGE_PHOTOS_QUERY_KEY: ["collage", "photos"],
  fetchCollagePhotos: vi.fn().mockResolvedValue(photos),
}));
vi.mock("@/features/film/lib/queries", () => ({
  FILM_QUERY_KEY: ["film"],
  fetchPublishedFilm: vi.fn().mockResolvedValue(filmRow),
}));
vi.mock("@/features/list/lib/queries", () => ({
  REGION_NODES_QUERY_KEY: (region: string) => ["list", "region-nodes", region],
  fetchRegionNodes: vi.fn().mockResolvedValue(nodes),
}));

function renderRegion(region: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/list/${region}`]}>
        <Routes>
          <Route path="/list/:region" element={<ListRegion />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setViewpointsCache(viewpoints);
});

afterEach(() => {
  clearViewpointsCache();
});

describe("ListRegion", () => {
  it("lists real photos for the collage region, not the internal region-label placeholder", async () => {
    renderRegion("collage");

    await waitFor(() => expect(screen.getByText(/The first cast/)).toBeInTheDocument());
    expect(screen.getByText("The first cast — 2026-03-14")).toBeInTheDocument();
    expect(screen.queryByText("region-label")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing published here yet.")).not.toBeInTheDocument();
  });

  it("shows the empty-state message for a region with only the placeholder node", async () => {
    renderRegion("shop");

    await waitFor(() => expect(screen.getByText("Nothing published here yet.")).toBeInTheDocument());
    expect(screen.queryByText("region-label")).not.toBeInTheDocument();
  });

  it("shows the About region's real copy, not the empty-state message (T6)", async () => {
    renderRegion("about");

    await waitFor(() => expect(screen.getByText("Light entering from darkness.")).toBeInTheDocument());
    expect(screen.getByText("Artworks")).toBeInTheDocument();
    expect(screen.queryByText("Nothing published here yet.")).not.toBeInTheDocument();
  });

  it("shows the Contact region's intro and a real mailto link, not the empty-state message (T6)", async () => {
    renderRegion("contact");

    await waitFor(() =>
      expect(screen.getByText("Commissions, collaborations, press or a question about a belt.")).toBeInTheDocument()
    );
    expect(screen.getByRole("link", { name: "Email ALL LIFE directly" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:/)
    );
    expect(screen.queryByText("Nothing published here yet.")).not.toBeInTheDocument();
  });
});
