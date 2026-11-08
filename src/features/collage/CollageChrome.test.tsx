import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "@/canvas/store";
import { clearViewpointsCache, setViewpointsCache } from "@/canvas/viewpoints";

import { CollageChrome } from "./CollageChrome";
import { useCollageViewStore } from "./collageViewStore";

const { photos } = vi.hoisted(() => ({
  photos: [] as Array<{
    id: string;
    title: string;
    takenOn: string | null;
    shoot: { id: string; title: string };
    media: { id: string; width: number | null; height: number | null; blurDataUrl: string | null; renditions: Record<string, string> };
  }>,
}));

vi.mock("./lib/queries", () => ({
  COLLAGE_PHOTOS_QUERY_KEY: ["collage", "photos"],
  fetchCollagePhotos: vi.fn().mockResolvedValue(photos),
}));

const viewpoints = [
  { key: "gallery", label: "Gallery", x: 2000, y: 0, zoom: 1, sortOrder: 1, inGuidedPath: true },
  { key: "collage", label: "Collage", x: 2000, y: 1200, zoom: 1, sortOrder: 2, inGuidedPath: true },
];

function setCameraNearCollage() {
  useCameraStore.setState({
    camera: { x: 2000, y: 1200, zoom: 1 },
    viewport: { width: 1000, height: 800 },
    isFlying: false,
  });
}

function renderCollageChrome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <CollageChrome />
    </QueryClientProvider>
  );
  return { ...result, queryClient };
}

function onePhoto(shootId: string, shootTitle: string) {
  return {
    id: `photo-${shootId}`,
    title: `Photo in ${shootTitle}`,
    takenOn: null,
    shoot: { id: shootId, title: shootTitle },
    media: { id: `media-${shootId}`, width: 100, height: 100, blurDataUrl: null, renditions: {} },
  };
}

describe("CollageChrome", () => {
  beforeEach(() => {
    setViewpointsCache(viewpoints);
    useCollageViewStore.setState({ layoutMode: "circular", activeShootId: null });
    photos.length = 0;
    // Recentre's flyTo() otherwise animates over real rAF frames, which
    // this environment doesn't reliably advance within a single test —
    // reduced motion makes it resolve synchronously, same as
    // CanvasChrome.test.tsx's own Home test.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    clearViewpointsCache();
    useCollageViewStore.setState({ layoutMode: "circular", activeShootId: null });
    vi.unstubAllGlobals();
  });

  it("renders nothing when the camera isn't near the collage viewpoint", async () => {
    useCameraStore.setState({
      camera: { x: 0, y: 0, zoom: 1 },
      viewport: { width: 1000, height: 800 },
      isFlying: false,
    });
    const { container } = renderCollageChrome();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("offers the Circle/Diagonal strips toggle once near the collage, and writes layoutMode", async () => {
    setCameraNearCollage();
    renderCollageChrome();

    const circle = await screen.findByRole("button", { name: "Circle" });
    const strips = screen.getByRole("button", { name: "Diagonal strips" });
    expect(useCollageViewStore.getState().layoutMode).toBe("circular");

    fireEvent.click(strips);
    expect(useCollageViewStore.getState().layoutMode).toBe("strips");

    fireEvent.click(circle);
    expect(useCollageViewStore.getState().layoutMode).toBe("circular");
  });

  it("hides the shoot-filter row for a single shoot, shows it and filters for several", async () => {
    photos.push(onePhoto("set-a", "Studio"));
    setCameraNearCollage();
    const { queryClient } = renderCollageChrome();

    await screen.findByRole("button", { name: "Circle" });
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();

    photos.push(onePhoto("set-b", "On location"));
    await queryClient.invalidateQueries();

    await waitFor(() => expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "On location" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Studio" }));
    expect(useCollageViewStore.getState().activeShootId).toBe("set-a");

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(useCollageViewStore.getState().activeShootId).toBeNull();
  });

  it("Zoom in/out and Recentre move the real camera", async () => {
    setCameraNearCollage();
    renderCollageChrome();
    await screen.findByRole("button", { name: "Circle" });

    const before = useCameraStore.getState().camera.zoom;
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(useCameraStore.getState().camera.zoom).toBeGreaterThan(before);

    const zoomedIn = useCameraStore.getState().camera.zoom;
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(useCameraStore.getState().camera.zoom).toBeLessThan(zoomedIn);

    useCameraStore.getState().setCamera({ x: 999, y: 999, zoom: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Recentre" }));
    await waitFor(() => expect(useCameraStore.getState().camera.x).toBeCloseTo(2000));
  });
});
