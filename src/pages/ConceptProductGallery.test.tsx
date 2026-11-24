import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { useProductsMock } = vi.hoisted(() => ({ useProductsMock: vi.fn() }));
vi.mock("@/features/shop/lib/useProducts", () => ({ useProducts: useProductsMock }));

import ConceptProductGallery from "./ConceptProductGallery";

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "sample-belt-no-1",
    name: "Sample Belt No.1",
    priceAmount: 40,
    priceCurrency: "GBP",
    description: null,
    bullets: [],
    status: "available",
    zone: "wall",
    onSale: false,
    sortOrder: 0,
    poster: null,
    ...overrides,
  };
}

describe("ConceptProductGallery", () => {
  it("shows a loading state", () => {
    useProductsMock.mockReturnValue({ data: undefined, isLoading: true });
    render(<MemoryRouter><ConceptProductGallery /></MemoryRouter>);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an empty state once loaded with nothing published", () => {
    useProductsMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    render(<MemoryRouter><ConceptProductGallery /></MemoryRouter>);
    expect(screen.getByText("Nothing published yet.")).toBeInTheDocument();
  });

  it("shows an error state with a retry action, not the empty state, when the query fails", () => {
    const refetch = vi.fn();
    useProductsMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<MemoryRouter><ConceptProductGallery /></MemoryRouter>);
    expect(screen.getByText("Couldn't load the catalogue.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing published yet.")).not.toBeInTheDocument();
    screen.getByText("Try again").click();
    expect(refetch).toHaveBeenCalled();
  });

  it("links each real product through to its own concept panel", () => {
    useProductsMock.mockReturnValue({
      data: [product({ id: "p1", slug: "sample-belt-no-1", name: "Sample Belt No.1" }), product({ id: "p2", slug: "rio-1", name: "Rio 1" })],
      isLoading: false,
    });
    render(<MemoryRouter><ConceptProductGallery /></MemoryRouter>);

    expect(screen.getByText("Rio 1")).toBeInTheDocument();
    const link = screen.getByText("Rio 1").closest("a");
    expect(link).toHaveAttribute("href", "/concept/products/rio-1");
  });
});
