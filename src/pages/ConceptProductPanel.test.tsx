import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useProductMock } = vi.hoisted(() => ({ useProductMock: vi.fn() }));
vi.mock("@/features/shop/lib/useProducts", () => ({ useProduct: useProductMock }));

const attachHls = vi.fn().mockReturnValue({ destroy: vi.fn() });
vi.mock("@/features/film/lib/hls", () => ({
  attachHls: (...args: unknown[]) => attachHls(...args),
}));

import ConceptProductPanel from "./ConceptProductPanel";

function media(overrides: Record<string, unknown> = {}) {
  return {
    id: "media-1",
    width: 1200,
    height: 1200,
    blurDataUrl: null,
    renditions: { "1280": "products/p1/media-1/1280.webp" },
    storagePath: "products/p1/media-1",
    hlsMaster: null,
    ...overrides,
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "rio-1",
    name: "Rio 1",
    priceAmount: 120,
    priceCurrency: "GBP",
    description: "A description.",
    bullets: ["Upcycled bike-tyre strap", "Sand-cast aluminium buckle"],
    status: "available",
    zone: "wall",
    onSale: false,
    sortOrder: 0,
    poster: media(),
    pictures: [],
    video: media({ id: "video-1", storagePath: "products/p1/video-1" }),
    ...overrides,
  };
}

function renderPanel(slug = "rio-1") {
  return render(
    <MemoryRouter initialEntries={[`/concept/products/${slug}`]}>
      <Routes>
        <Route path="/concept/products/:slug" element={<ConceptProductPanel />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConceptProductPanel", () => {
  it("shows a loading state", () => {
    useProductMock.mockReturnValue({ data: undefined, isLoading: true });
    renderPanel();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a not-available state with a way back, for a null product", () => {
    useProductMock.mockReturnValue({ data: null, isLoading: false });
    renderPanel();
    expect(screen.getByText("This item isn't available")).toBeInTheDocument();
    expect(screen.getByText("Back to all pieces").closest("a")).toHaveAttribute("href", "/concept/products");
  });

  it("fetches by the real route slug and renders the real product's details", () => {
    useProductMock.mockReturnValue({ data: product(), isLoading: false });
    renderPanel("rio-1");

    expect(useProductMock).toHaveBeenCalledWith("rio-1");
    expect(screen.getAllByText("Rio 1").length).toBeGreaterThan(0);
    expect(screen.getByText("£120.00")).toBeInTheDocument();
    expect(screen.getByText("Upcycled bike-tyre strap")).toBeInTheDocument();
    expect(screen.getByText("‹ Back to Shop")).toHaveAttribute("href", "/concept/products");
  });

  it("plays the real turntable video and lets the toggles pause/mute it", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    useProductMock.mockReturnValue({ data: product(), isLoading: false });
    renderPanel();

    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true);

    fireEvent.click(screen.getByText("⏸ Autoplay"));
    expect(pauseSpy).toHaveBeenCalled();
    expect(screen.getByText("⏵ Autoplay")).toBeInTheDocument();

    fireEvent.click(screen.getByText("🔈 Sound"));
    expect(video.muted).toBe(false);
  });

  it("copies the owner's email address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useProductMock.mockReturnValue({ data: product(), isLoading: false });
    renderPanel();

    fireEvent.click(screen.getByText("Copy email address"));
    expect(writeText).toHaveBeenCalledWith("owner@example.com");
  });

  it("shows a sold message instead of a buy link for a sold piece", () => {
    useProductMock.mockReturnValue({ data: product({ status: "sold" }), isLoading: false });
    renderPanel();
    expect(screen.getByText(/Sold — ask about something similar/)).toBeInTheDocument();
    expect(screen.queryByText("Buy / Enquire")).not.toBeInTheDocument();
  });
});
