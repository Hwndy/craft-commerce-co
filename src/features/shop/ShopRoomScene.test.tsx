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

describe("ShopRoomScene overflow affordance", () => {
  // docs/decisions.md: a count of 0 means ShopRegion.tsx is already handing
  // in the full catalogue for that zone — nothing to route elsewhere, so
  // no button should exist at all (not just be hidden/disabled).
  it("renders neither overflow button when both counts are 0", () => {
    render(<ShopRoomScene nodes={[]} />);

    expect(screen.queryByText(/more \(wall\) — view all/)).not.toBeInTheDocument();
    expect(screen.queryByText(/more \(floor\) — view all/)).not.toBeInTheDocument();
  });

  it("shows the wall's own overflow count and calls onViewAllWall when clicked", async () => {
    const onViewAllWall = vi.fn();
    const user = userEvent.setup();
    render(<ShopRoomScene nodes={[]} wallOverflowCount={3} onViewAllWall={onViewAllWall} />);

    const button = screen.getByText("+3 more (wall) — view all");
    await user.click(button);
    expect(onViewAllWall).toHaveBeenCalledTimes(1);
  });

  it("shows the floor's own overflow count independently and calls onViewAllFloor when clicked", async () => {
    const onViewAllFloor = vi.fn();
    const user = userEvent.setup();
    render(<ShopRoomScene nodes={[]} floorOverflowCount={1} onViewAllFloor={onViewAllFloor} />);

    const buttons = screen.getAllByText("+1 more (floor) — view all");
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0]);
    expect(onViewAllFloor).toHaveBeenCalledTimes(1);
  });
});
