import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "@/canvas/store";

import { Collage } from "./Collage";

// useCollagePhotos() calls the real fetchCollagePhotos(), which hits
// supabase-js — mocked here so the test exercises the real wiring
// (query resolves -> nodes render through NodeLayer) rather than a stub.
const { photos } = vi.hoisted(() => ({
  photos: [
    {
      id: "photo-1",
      title: "The first cast",
      takenOn: "2026-03-14",
      media: { id: "media-1", width: 2000, height: 1500, blurDataUrl: "data:image/webp;base64,AAA", renditions: { "256": "photos/set/media-1/256.webp", "640": "photos/set/media-1/640.webp" } },
    },
    {
      id: "photo-2",
      title: "Finishing the buckle",
      takenOn: null,
      media: { id: "media-2", width: 1500, height: 2000, blurDataUrl: null, renditions: { "256": "photos/set/media-2/256.webp", "640": "photos/set/media-2/640.webp" } },
    },
  ],
}));

vi.mock("./lib/queries", () => ({
  COLLAGE_PHOTOS_QUERY_KEY: ["collage", "photos"],
  fetchCollagePhotos: vi.fn().mockResolvedValue(photos),
}));

function renderCollage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Collage centerX={2000} centerY={1200} />
    </QueryClientProvider>
  );
}

describe("Collage", () => {
  beforeEach(() => {
    useCameraStore.setState({
      camera: { x: 2000, y: 1200, zoom: 1 },
      viewport: { width: 2000, height: 2000 },
      isFlying: false,
    });
  });

  it("renders one focusable, labelled node per published photo once the query resolves", async () => {
    renderCollage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "The first cast, 2026-03-14" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Finishing the buckle" })).toBeInTheDocument();
  });

  it("renders no photo nodes and doesn't crash when nothing is published yet", async () => {
    vi.mocked((await import("./lib/queries")).fetchCollagePhotos).mockResolvedValueOnce([]);
    const { container } = renderCollage();

    await waitFor(() => {
      expect(container.querySelector("[data-node-layer-count]")?.getAttribute("data-node-layer-count")).toBe("0");
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
