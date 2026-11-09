import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCameraStore } from "@/canvas/store";

import { Collage, RISE_DURATION_MS } from "./Collage";
import { useCollageViewStore } from "./collageViewStore";

// useCollagePhotos() calls the real fetchCollagePhotos(), which hits
// supabase-js — mocked here so the test exercises the real wiring
// (query resolves -> nodes render through NodeLayer) rather than a stub.
// photo-2 is in a different shoot from photo-1 so the shoot filter
// (docs/decisions.md D-45) has something real to filter.
const { photos } = vi.hoisted(() => ({
  photos: [
    {
      id: "photo-1",
      title: "The first cast",
      takenOn: "2026-03-14",
      shoot: { id: "set-a", title: "Studio" },
      media: { id: "media-1", width: 2000, height: 1500, blurDataUrl: "data:image/webp;base64,AAA", renditions: { "256": "photos/set/media-1/256.webp", "640": "photos/set/media-1/640.webp" } },
    },
    {
      id: "photo-2",
      title: "Finishing the buckle",
      takenOn: null,
      shoot: { id: "set-b", title: "On location" },
      media: { id: "media-2", width: 1500, height: 2000, blurDataUrl: null, renditions: { "256": "photos/set/media-2/256.webp", "640": "photos/set/media-2/640.webp" } },
    },
  ],
}));

vi.mock("./lib/queries", () => ({
  COLLAGE_PHOTOS_QUERY_KEY: ["collage", "photos"],
  fetchCollagePhotos: vi.fn().mockResolvedValue(photos),
}));

function renderCollage(onOpenPhoto?: (id: string) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Collage centerX={2000} centerY={1200} onOpenPhoto={onOpenPhoto} />
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
    useCollageViewStore.setState({ layoutMode: "circular", activeShootId: null });
  });

  afterEach(() => {
    useCollageViewStore.setState({ layoutMode: "circular", activeShootId: null });
  });

  it("renders one focusable, labelled node per published photo once the query resolves", async () => {
    renderCollage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "The first cast, 2026-03-14" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Finishing the buckle" })).toBeInTheDocument();
  });

  it("calls onOpenPhoto with the photo's id when a node is clicked", async () => {
    const onOpenPhoto = vi.fn();
    renderCollage(onOpenPhoto);

    const node = await screen.findByRole("button", { name: "The first cast, 2026-03-14" });
    fireEvent.click(node);
    expect(onOpenPhoto).toHaveBeenCalledWith("photo-1");
  });

  it("hides photos from other shoots once activeShootId filters to one (D-45), without moving the ones that stay", async () => {
    renderCollage();
    const first = await screen.findByRole("button", { name: "The first cast, 2026-03-14" });
    const firstLeft = first.parentElement?.style.left;
    expect(screen.getByRole("button", { name: "Finishing the buckle" })).toBeInTheDocument();

    await act(async () => {
      useCollageViewStore.getState().setActiveShootId("set-a");
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Finishing the buckle" })).not.toBeInTheDocument();
    });
    const firstAfterFilter = screen.getByRole("button", { name: "The first cast, 2026-03-14" });
    expect(firstAfterFilter.parentElement?.style.left).toBe(firstLeft);
  });

  // The owner's own "strips" sketch (docs/decisions.md D-62): clicking a
  // photo should visibly rise out of its stack before the viewer opens.
  it("in strips mode, rises the clicked photo for RISE_DURATION_MS before calling onOpenPhoto", async () => {
    useCollageViewStore.setState({ layoutMode: "strips", activeShootId: null });
    const onOpenPhoto = vi.fn();
    renderCollage(onOpenPhoto);
    const node = await screen.findByRole("button", { name: "The first cast, 2026-03-14" });

    vi.useFakeTimers();
    try {
      act(() => {
        fireEvent.click(node);
      });
      expect(onOpenPhoto).not.toHaveBeenCalled();
      // Found in review (Greptile, PR #5): the earlier version of this test
      // only checked the delayed callback, so it would still pass with the
      // rise transform/zIndex removed entirely — asserting the clicked
      // card's own wrapper actually rises (and clears its neighbours) is
      // the whole point of this behaviour, not just the timing.
      const wrapper = node.parentElement as HTMLElement;
      expect(wrapper.style.transform).toContain("translateY(-28px)");
      expect(wrapper.style.transform).toContain("scale(1.08)");
      expect(wrapper.style.zIndex).toBe("10");

      await act(async () => {
        vi.advanceTimersByTime(RISE_DURATION_MS);
      });
      expect(onOpenPhoto).toHaveBeenCalledWith("photo-1");
      expect(wrapper.style.transform).not.toContain("translateY");
      expect(wrapper.style.zIndex).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  // Found in review (Greptile, PR #5): a second activation before the
  // first one finishes rising previously started a second, independent
  // timer — both eventually fired onOpenPhoto, pushing two viewer entries
  // into history instead of replacing the pending one.
  it("in strips mode, a second click before the first rise finishes cancels the first timer instead of firing twice", async () => {
    useCollageViewStore.setState({ layoutMode: "strips", activeShootId: null });
    const onOpenPhoto = vi.fn();
    renderCollage(onOpenPhoto);
    const node = await screen.findByRole("button", { name: "The first cast, 2026-03-14" });

    vi.useFakeTimers();
    try {
      act(() => {
        fireEvent.click(node);
      });
      await act(async () => {
        vi.advanceTimersByTime(RISE_DURATION_MS / 2);
      });
      act(() => {
        fireEvent.click(node);
      });
      await act(async () => {
        vi.advanceTimersByTime(RISE_DURATION_MS / 2);
      });
      // Only the first timer's original deadline has passed; the second
      // click's own full RISE_DURATION_MS hasn't elapsed yet.
      expect(onOpenPhoto).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(RISE_DURATION_MS / 2);
      });
      expect(onOpenPhoto).toHaveBeenCalledTimes(1);
      expect(onOpenPhoto).toHaveBeenCalledWith("photo-1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("in strips mode, skips the rise delay and opens immediately when reduced motion is preferred", async () => {
    useCollageViewStore.setState({ layoutMode: "strips", activeShootId: null });
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const onOpenPhoto = vi.fn();
    renderCollage(onOpenPhoto);
    const node = await screen.findByRole("button", { name: "The first cast, 2026-03-14" });

    act(() => {
      fireEvent.click(node);
    });
    expect(onOpenPhoto).toHaveBeenCalledWith("photo-1");

    matchMediaSpy.mockRestore();
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
