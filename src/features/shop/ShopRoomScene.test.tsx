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

  // The permanent accessibility/SEO affordance (ShopRoomScene.tsx's own
  // comment) only exists when ShopRegion.tsx actually has a list route to
  // link to for that zone — docs/decisions.md D-82 dropped the old
  // overflow-count gate, not the "only render a link that goes somewhere"
  // rule.
  it("renders neither 'view all' link when no handler is given", () => {
    render(<ShopRoomScene nodes={[]} page={0} totalPages={1} />);

    expect(screen.queryByRole("button", { name: "View all (wall)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View all (floor)" })).not.toBeInTheDocument();
  });

  it("renders each 'view all' link once its handler is given, and calls it on click", async () => {
    const onViewAllWall = vi.fn();
    const onViewAllFloor = vi.fn();
    const user = userEvent.setup();
    render(
      <ShopRoomScene
        nodes={[]}
        page={0}
        totalPages={1}
        onViewAllWall={onViewAllWall}
        onViewAllFloor={onViewAllFloor}
      />
    );

    await user.click(screen.getByRole("button", { name: "View all (wall)" }));
    expect(onViewAllWall).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "View all (floor)" }));
    expect(onViewAllFloor).toHaveBeenCalledTimes(1);
  });
});
