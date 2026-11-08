import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProductDetail, ProductMedia } from "./lib/queries";
import { ProductOverlay } from "./ProductOverlay";

function media(overrides: Partial<ProductMedia> = {}): ProductMedia {
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

function product(overrides: Partial<ProductDetail> = {}): ProductDetail {
  return {
    id: "product-1",
    slug: "sample-belt-no-5",
    name: "Sample Belt No.5",
    priceAmount: 40,
    priceCurrency: "GBP",
    description: "Black tyre belt with aluminium buckle.",
    bullets: ["Belt made from repurposed bike tyre", "Buckle sand-cast using discarded aluminium"],
    status: "available",
    zone: "floor",
    onSale: false,
    poster: media(),
    pictures: [media()],
    video: null,
    ...overrides,
  };
}

describe("ProductOverlay", () => {
  it("renders nothing when no slug is open", () => {
    const { container } = render(<ProductOverlay slug={null} product={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a loading state (with its own accessible title) while the product query is still in flight", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={undefined} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a not-available state for a slug with no published product", () => {
    render(<ProductOverlay slug="stale-link" product={null} onClose={vi.fn()} />);
    expect(screen.getByText("This item isn't available")).toBeInTheDocument();
  });

  it("shows the product's name, price, status, bullets and story text", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
    expect(screen.getByText("Sample Belt No.5")).toBeInTheDocument();
    expect(screen.getByText("£40.00")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Belt made from repurposed bike tyre")).toBeInTheDocument();
    expect(screen.getByText("Black tyre belt with aluminium buckle.")).toBeInTheDocument();
  });

  it("shows a Sale badge when onSale is true", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product({ onSale: true })} onClose={vi.fn()} />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
  });

  // FR-4.3: the toggle only makes sense once there's something to toggle
  // to — a product with no video is exactly today's real seeded content
  // (docs/decisions.md D-51), so this is the common case, not an edge one.
  it("does not offer a Pictures/Video toggle when the product has no video", () => {
    render(<ProductOverlay slug="sample-belt-no-5" product={product()} onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Video" })).not.toBeInTheDocument();
  });

  it("offers the Pictures/Video toggle when the product has a video with a real source", () => {
    render(
      <ProductOverlay
        slug="sample-belt-no-5"
        product={product({ video: media({ id: "video-1", hlsMaster: "products/p1/video-1/master.m3u8" }) })}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pictures" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Video" })).toBeInTheDocument();
  });

  it("calls onClose when the close button is activated", async () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <ProductOverlay slug="sample-belt-no-5" product={product()} onClose={onClose} />
    );
    getByLabelText("Close").click();
    expect(onClose).toHaveBeenCalled();
  });
});
