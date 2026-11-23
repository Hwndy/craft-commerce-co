// A focused integration test, deliberately *not* mocking ProductForm (the
// rest of AdminProducts.test.tsx does, for every other scenario) — found
// in review (CodeRabbit, PR #38): the session-token fix for the
// stale-callback race (docs/decisions.md D-85 update 8) kept the same
// `key` across the create→edit transition on purpose, for the
// stale-callback comparison — but that meant ProductForm never remounted
// on creation, so react-hook-form kept its stale create-mode
// defaultValues (an empty slug) once the now-active edit-mode schema
// started requiring one, blocking Save until the admin typed a slug by
// hand. A mocked ProductForm can't catch that, since it never actually
// calls useForm — only the real component, through a real remount, can.
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminProductRow } from "./lib/adminProducts";

const { useAdminProducts, createMutateAsync, updateMutateAsync, useProductPictures } = vi.hoisted(() => ({
  useAdminProducts: vi.fn(),
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
  useProductPictures: vi.fn(),
}));

vi.mock("./lib/adminProducts", async () => {
  const actual = await vi.importActual<typeof import("./lib/adminProducts")>("./lib/adminProducts");
  return {
    ...actual,
    useAdminProducts,
    useReorderProduct: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateProduct: () => ({ mutateAsync: createMutateAsync }),
    useUpdateProduct: () => ({ mutateAsync: updateMutateAsync }),
    useDeleteProduct: () => ({ mutateAsync: vi.fn() }),
    useAddProductPicture: () => ({ mutate: vi.fn() }),
    useRemoveProductPicture: () => ({ mutate: vi.fn() }),
    useProductPictures,
  };
});

// Media sections aren't exercised by this test — stubbed out exactly like
// ProductForm.test.tsx's own MediaUploadField mock, minus the upload
// interaction this test doesn't need.
vi.mock("./components/MediaUploadField", () => ({
  MediaUploadField: () => null,
}));

import AdminProducts from "./AdminProducts";

function createdProduct(overrides: Partial<AdminProductRow> = {}): AdminProductRow {
  return {
    id: "real-id",
    slug: "real-slug-123",
    name: "Real Product",
    priceAmount: 25,
    priceCurrency: "GBP",
    description: null,
    bullets: [],
    status: "available",
    zone: "floor",
    onSale: false,
    sortOrder: 0,
    posterMediaId: null,
    videoMediaId: null,
    published: false,
    ...overrides,
  };
}

useProductPictures.mockReturnValue({ data: [] });

afterEach(() => {
  vi.clearAllMocks();
  useProductPictures.mockReturnValue({ data: [] });
});

describe("AdminProducts create→edit transition (real ProductForm)", () => {
  it("remounts with the real created product's slug, and a subsequent edit save still carries it", async () => {
    useAdminProducts.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    const created = createdProduct();
    createMutateAsync.mockResolvedValue(created);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminProducts />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "New product" }));
    await user.type(screen.getByLabelText("Name"), "Real Product");
    const priceInput = screen.getByLabelText("Price (GBP)");
    await user.clear(priceInput);
    await user.type(priceInput, "25");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalled());

    // The regression: without a real remount, this would still show "".
    await waitFor(() => expect(screen.getByLabelText("Slug")).toHaveValue("real-slug-123"));

    updateMutateAsync.mockResolvedValue(created);
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: "real-id", slug: "real-slug-123" }))
    );
  });
});
