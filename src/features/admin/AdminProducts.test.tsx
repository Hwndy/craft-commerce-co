import { act } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminProductRow } from "./lib/adminProducts";

const { useAdminProducts, reorderMutate } = vi.hoisted(() => ({
  useAdminProducts: vi.fn(),
  reorderMutate: vi.fn(),
}));
vi.mock("./lib/adminProducts", async () => {
  const actual = await vi.importActual<typeof import("./lib/adminProducts")>("./lib/adminProducts");
  return {
    ...actual,
    useAdminProducts,
    useReorderProduct: () => ({ mutate: reorderMutate }),
  };
});

const formSpy = vi.hoisted(() => vi.fn());
vi.mock("./components/ProductForm", () => ({
  ProductForm: (props: unknown) => {
    formSpy(props);
    return <div data-testid="product-form" />;
  },
}));

import AdminProducts from "./AdminProducts";

afterEach(() => {
  vi.clearAllMocks();
});

function product(overrides: Partial<AdminProductRow> = {}): AdminProductRow {
  return {
    id: "p1",
    slug: "sample-belt",
    name: "Sample Belt",
    priceAmount: 40,
    priceCurrency: "GBP",
    description: null,
    bullets: [],
    status: "available",
    zone: "floor",
    onSale: false,
    sortOrder: 0,
    posterMediaId: null,
    videoMediaId: null,
    published: true,
    ...overrides,
  };
}

function mockProducts(products: AdminProductRow[]) {
  useAdminProducts.mockReturnValue({ data: products, isLoading: false });
}

describe("AdminProducts", () => {
  it("renders every product with its price, zone and status", () => {
    mockProducts([product({ id: "p1", name: "Belt One" }), product({ id: "p2", name: "Belt Two", zone: "wall" })]);
    render(<AdminProducts />);

    expect(screen.getByText("Belt One")).toBeInTheDocument();
    expect(screen.getByText("Belt Two")).toBeInTheDocument();
    expect(screen.getAllByText(/£40\.00/)).toHaveLength(2);
  });

  it("marks an unpublished product", () => {
    mockProducts([product({ published: false })]);
    render(<AdminProducts />);
    expect(screen.getByText(/Unpublished/)).toBeInTheDocument();
  });

  it("disables the up button on the first item and the down button on the last", () => {
    mockProducts([product({ id: "p1", name: "First" }), product({ id: "p2", name: "Second" })]);
    render(<AdminProducts />);

    expect(screen.getByRole("button", { name: 'Move "First" up' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "First" down' })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "Second" up' })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "Second" down' })).toBeDisabled();
  });

  it("calls the reorder mutation with the full product list and the clicked id/direction", async () => {
    const products = [product({ id: "p1", name: "First" }), product({ id: "p2", name: "Second" })];
    mockProducts(products);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: 'Move "Second" up' }));
    expect(reorderMutate).toHaveBeenCalledWith({ products, id: "p2", direction: "up" });
  });

  it("opens the drawer in create mode (no product) when 'New product' is clicked", async () => {
    mockProducts([]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    expect(screen.getByTestId("product-form")).toBeInTheDocument();
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: undefined }));
  });

  it("opens the drawer in edit mode with the clicked product", async () => {
    const belt = product({ id: "p1", name: "Belt One" });
    mockProducts([belt]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: /^Belt One/ }));
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: belt }));
  });

  it("switches the drawer to edit mode for the created product when ProductForm calls onCreated", async () => {
    mockProducts([]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    const created = product({ id: "new-id", name: "Brand New" });
    act(() => {
      formSpy.mock.calls.at(-1)![0].onCreated(created);
    });

    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: created }));
  });
});
