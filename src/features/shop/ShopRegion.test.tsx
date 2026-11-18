import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Product, ProductNode } from "./lib/queries";

const { useProductNodes } = vi.hoisted(() => ({ useProductNodes: vi.fn() }));
vi.mock("./lib/useProducts", () => ({ useProductNodes }));

const sceneSpy = vi.hoisted(() => vi.fn());
vi.mock("./ShopRoomScene", async () => {
  const actual = await vi.importActual<typeof import("./ShopRoomScene")>("./ShopRoomScene");
  return {
    ...actual,
    ShopRoomScene: (props: unknown) => {
      sceneSpy(props);
      return null;
    },
  };
});

import { ShopRegion } from "./ShopRegion";
import { ROOM_CAPACITY } from "./ShopRoomScene";

function product(name: string): Product {
  return {
    id: name,
    slug: name,
    name,
    priceAmount: 40,
    priceCurrency: "GBP",
    description: null,
    bullets: [],
    status: "available",
    zone: "wall",
    onSale: false,
    poster: null,
  };
}

function nodes(count: number, prefix: string): ProductNode[] {
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `${prefix}${i}`,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    product: product(`${prefix}${i}`),
  }));
}

function mockRegions(wallCount: number, floorCount: number) {
  useProductNodes.mockImplementation((region: string) =>
    region === "shop-wall"
      ? { data: nodes(wallCount, "wall-"), isLoading: false }
      : { data: nodes(floorCount, "floor-"), isLoading: false }
  );
}

describe("ShopRegion", () => {
  // docs/decisions.md D-78: the room's own fixed geometry has a real
  // visual capacity (ShopRoomScene.tsx's ROOM_CAPACITY, confirmed by
  // screenshot) shared across both admin zones now (no more separate wall
  // vs floor grids) — ShopRegion.tsx must cap what it hands the scene at
  // that number rather than forcing the real catalogue's full count in,
  // which is what clipped a real product even at today's actual counts.
  it("passes every product straight through, with zero overflow, when under capacity", () => {
    mockRegions(2, 2);
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = sceneSpy.mock.calls.at(-1)![0];
    expect(props.nodes).toHaveLength(4);
    expect(props.wallOverflowCount).toBe(0);
    expect(props.floorOverflowCount).toBe(0);
  });

  it("matches today's real catalogue (4 wall + 4 floor, D-70) with zero overflow at ROOM_CAPACITY=8", () => {
    mockRegions(4, 4);
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = sceneSpy.mock.calls.at(-1)![0];
    expect(props.nodes).toHaveLength(8);
    expect(props.wallOverflowCount).toBe(0);
    expect(props.floorOverflowCount).toBe(0);
  });

  it("fills the shared pool with wall items first, then reports the real floor overflow once ROOM_CAPACITY is exceeded", () => {
    mockRegions(6, 6);
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = sceneSpy.mock.calls.at(-1)![0];
    // Distinct wall-/floor-prefixed fixture ids (found in review,
    // CodeRabbit, PR #30) so this actually proves which products made the
    // cut, not just how many — all 6 wall items, then the first 2 floor
    // items, in that order.
    expect(props.nodes.map((n: ProductNode) => n.nodeId)).toEqual([
      "wall-0",
      "wall-1",
      "wall-2",
      "wall-3",
      "wall-4",
      "wall-5",
      "floor-0",
      "floor-1",
    ]);
    expect(props.wallOverflowCount).toBe(0);
    expect(props.floorOverflowCount).toBe(6 + 6 - ROOM_CAPACITY);
  });

  // Found in review (CodeRabbit, PR #30): shownFloor's own capacity now
  // depends on shownWall's real length (the two queries settle
  // independently), unlike the old WALL_CAPACITY/FLOOR_CAPACITY split —
  // computing it before both have resolved could render a floor list
  // that's about to shrink the moment the wall query catches up,
  // unmounting whatever a visitor had just focused. Nothing should render
  // until both are settled.
  it("renders nothing until both the wall and floor queries have settled", () => {
    useProductNodes.mockImplementation((region: string) =>
      region === "shop-wall"
        ? { data: undefined, isLoading: true }
        : { data: nodes(8, "floor-"), isLoading: false }
    );
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = sceneSpy.mock.calls.at(-1)![0];
    expect(props.nodes).toEqual([]);
    expect(props.wallOverflowCount).toBe(0);
    expect(props.floorOverflowCount).toBe(0);
  });

  it("reports the real wall overflow once wall items alone exceed ROOM_CAPACITY", () => {
    mockRegions(10, 0);
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = sceneSpy.mock.calls.at(-1)![0];
    expect(props.nodes).toHaveLength(ROOM_CAPACITY);
    expect(props.wallOverflowCount).toBe(10 - ROOM_CAPACITY);
    expect(props.floorOverflowCount).toBe(0);
  });

  it("forwards onViewAllWall/onViewAllFloor through to the scene untouched", () => {
    mockRegions(1, 1);
    const onViewAllWall = vi.fn();
    const onViewAllFloor = vi.fn();
    render(
      <ShopRegion
        title="Shop"
        centerX={0}
        centerY={0}
        onViewAllWall={onViewAllWall}
        onViewAllFloor={onViewAllFloor}
      />
    );

    const props = sceneSpy.mock.calls.at(-1)![0];
    expect(props.onViewAllWall).toBe(onViewAllWall);
    expect(props.onViewAllFloor).toBe(onViewAllFloor);
  });
});
