import { act, forwardRef, useImperativeHandle, type Ref } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminProductRow } from "./lib/adminProducts";

const { useAdminProducts, reorderMutate, reorderIsPending } = vi.hoisted(() => ({
  useAdminProducts: vi.fn(),
  reorderMutate: vi.fn(),
  // A plain mutable box, not a vi.fn() — read fresh on every render via
  // useReorderProduct() below, same as TanStack Query's own isPending.
  reorderIsPending: { value: false },
}));
vi.mock("./lib/adminProducts", async () => {
  const actual = await vi.importActual<typeof import("./lib/adminProducts")>("./lib/adminProducts");
  return {
    ...actual,
    useAdminProducts,
    useReorderProduct: () => ({ mutate: reorderMutate, isPending: reorderIsPending.value }),
  };
});

const { formSpy, confirmCloseMock } = vi.hoisted(() => ({
  formSpy: vi.fn(),
  // true by default ("safe to close") — individual tests override this
  // to simulate the admin declining to discard unsaved changes.
  confirmCloseMock: vi.fn(() => true),
}));
vi.mock("./components/ProductForm", () => ({
  // forwardRef + useImperativeHandle, matching the real component's
  // signature — AdminProducts.tsx passes a ref now (found in review,
  // CodeRabbit, PR #38: drawer dismiss needed a way to ask the form if
  // it's safe to close).
  ProductForm: forwardRef((props: unknown, ref: Ref<{ confirmClose: () => boolean }>) => {
    formSpy(props);
    useImperativeHandle(ref, () => ({ confirmClose: confirmCloseMock }));
    return <div data-testid="product-form" />;
  }),
}));

import AdminProducts from "./AdminProducts";

afterEach(() => {
  vi.clearAllMocks();
  reorderIsPending.value = false;
  confirmCloseMock.mockReturnValue(true);
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
  useAdminProducts.mockReturnValue({ data: products, isLoading: false, isError: false, refetch: vi.fn() });
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

  it("shows an error with a retry action instead of 'No products yet' when the query fails", async () => {
    const refetch = vi.fn();
    useAdminProducts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const user = userEvent.setup();
    render(<AdminProducts />);

    expect(screen.getByText("Couldn't load products.")).toBeInTheDocument();
    expect(screen.queryByText("No products yet.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("still lets the owner open 'New product' while the list failed to load", () => {
    useAdminProducts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<AdminProducts />);
    expect(screen.getByRole("button", { name: "New product" })).toBeInTheDocument();
  });

  it("keeps the drawer open when the form declines to close (unsaved changes)", async () => {
    confirmCloseMock.mockReturnValue(false);
    mockProducts([]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    expect(screen.getByTestId("product-form")).toBeInTheDocument();

    // The Sheet's own X button closes it (Radix renders it with an
    // accessible "Close" name) — this is the path that used to bypass
    // confirmIfDirty() entirely (found in review, CodeRabbit, PR #38).
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(confirmCloseMock).toHaveBeenCalled();
    expect(screen.getByTestId("product-form")).toBeInTheDocument();
  });

  it("shows a search-specific empty message, not 'No products yet', when a search has no matches", async () => {
    mockProducts([product({ id: "p1", name: "Belt One" })]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.type(screen.getByPlaceholderText("Search products…"), "nothing matches this");
    expect(screen.getByText("No products match your search.")).toBeInTheDocument();
    expect(screen.queryByText("No products yet.")).not.toBeInTheDocument();
  });

  it("closes the drawer when the form confirms it's safe to close", async () => {
    confirmCloseMock.mockReturnValue(true);
    mockProducts([]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("product-form")).not.toBeInTheDocument();
  });

  it("disables both reorder buttons on every row while a reorder is in flight", () => {
    reorderIsPending.value = true;
    mockProducts([product({ id: "p1", name: "First" }), product({ id: "p2", name: "Second" })]);
    render(<AdminProducts />);

    expect(screen.getByRole("button", { name: 'Move "First" down' })).toBeDisabled();
    expect(screen.getByRole("button", { name: 'Move "Second" up' })).toBeDisabled();
  });

  // Found in review (CodeRabbit, PR #38): ProductForm's onClose/onCreated
  // props are plain closures, and mutateAsync() inside it isn't cancelled
  // when this component's own `key` changes under it (the admin opened a
  // different product while a save/delete was still in flight) — the
  // callback that instance was given still fires once its own request
  // settles, well after a different product's drawer is already open.
  it("doesn't let a stale onClose from a since-abandoned product close whatever drawer is open now", async () => {
    const belt1 = product({ id: "p1", name: "Belt One" });
    const belt2 = product({ id: "p2", name: "Belt Two" });
    mockProducts([belt1, belt2]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: /^Belt One/ }));
    const staleOnClose = formSpy.mock.calls.at(-1)![0].onClose as () => void;

    // The admin dismisses Belt One's drawer (its own save/delete request
    // may still be in flight in the background — closing the drawer
    // doesn't wait for it) and opens a different product instead. Radix's
    // Sheet hides the background list from the accessibility tree while
    // open, so the next row has to be clicked after this one closes.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: /^Belt Two/ }));
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: belt2 }));

    // Belt One's request finally settles and calls the onClose it was
    // given — this must not touch Belt Two's still-open drawer.
    act(() => {
      staleOnClose();
    });
    expect(screen.getByTestId("product-form")).toBeInTheDocument();
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: belt2 }));
  });

  it("doesn't let a stale onCreated from an abandoned 'New product' draft replace whatever drawer is open now", async () => {
    const belt = product({ id: "p1", name: "Belt One" });
    mockProducts([belt]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    const staleOnCreated = formSpy.mock.calls.at(-1)![0].onCreated as (p: AdminProductRow) => void;

    // The admin abandons the draft (its own create request may still be
    // in flight in the background) and opens a real product instead.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: /^Belt One/ }));
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: belt }));

    // The abandoned draft's create() finally resolves and calls onCreated —
    // this must not replace Belt One's own drawer with the new product.
    act(() => {
      staleOnCreated(product({ id: "new-id", name: "Brand New" }));
    });
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: belt }));
  });

  // Found in review (CodeRabbit, PR #38), as a direct follow-up to the
  // fix the test above guards: that fix scoped onClose/onCreated by
  // comparing against the literal `"new"` string, which still collides
  // when *both* the abandoned draft and the one now open are "new"
  // drafts — they'd share the same `"new"` identity, so this case slips
  // past a check that only distinguishes "new" from a real product.
  it("doesn't let a stale onCreated from one abandoned 'New product' draft replace a second, later 'New product' draft", async () => {
    mockProducts([]);
    const user = userEvent.setup();
    render(<AdminProducts />);

    await user.click(screen.getByRole("button", { name: "New product" }));
    const staleOnCreated = formSpy.mock.calls.at(-1)![0].onCreated as (p: AdminProductRow) => void;

    // Abandon the first draft and start a second, unrelated one — both
    // are "new product" drafts.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "New product" }));
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: undefined }));

    // The first (abandoned) draft's create() finally resolves — this
    // must not replace the second draft's own, still-unsaved session.
    act(() => {
      staleOnCreated(product({ id: "first-draft-id", name: "First Draft" }));
    });
    expect(formSpy).toHaveBeenLastCalledWith(expect.objectContaining({ product: undefined }));
  });
});
