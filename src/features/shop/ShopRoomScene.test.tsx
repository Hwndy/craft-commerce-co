import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ShopRoomScene } from "./ShopRoomScene";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShopRoomScene pagination (docs/decisions.md D-82)", () => {
  it("renders no pagination controls when there's only one page", () => {
    render(<ShopRoomScene nodes={[]} page={0} totalPages={1} />);

    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous products" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next products" })).not.toBeInTheDocument();
  });

  it("shows the page indicator and wires Prev/Next once there's more than one page", async () => {
    const onPrevPage = vi.fn();
    const onNextPage = vi.fn();
    const user = userEvent.setup();
    render(
      <ShopRoomScene nodes={[]} page={0} totalPages={2} onPrevPage={onPrevPage} onNextPage={onNextPage} />
    );

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    const prev = screen.getByRole("button", { name: "Previous products" });
    const next = screen.getByRole("button", { name: "Next products" });
    expect(prev).toBeDisabled();
    expect(next).not.toBeDisabled();

    await user.click(next);
    expect(onNextPage).toHaveBeenCalledTimes(1);
    expect(onPrevPage).not.toHaveBeenCalled();
  });

  it("disables Next (not Prev) on the last page", () => {
    render(<ShopRoomScene nodes={[]} page={1} totalPages={2} />);

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous products" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next products" })).toBeDisabled();
  });

  // D-82 had this room link "View all (wall)"/"View all (floor)" to the
  // plain-text /list/shop-wall and /list/shop-floor pages; removed per
  // D-84, the owner's own direct instruction — visitors shouldn't be sent
  // there from here. Regression guard: no such links exist any more.
  it("never renders a 'view all' link", () => {
    render(<ShopRoomScene nodes={[]} page={0} totalPages={1} />);

    expect(screen.queryByRole("button", { name: /View all/ })).not.toBeInTheDocument();
  });
});
