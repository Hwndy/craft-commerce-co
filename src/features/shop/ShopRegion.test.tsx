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

function nodes(count: number): ProductNode[] {
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `n${i}`,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    product: product(`p${i}`),
  }));
}

function mockRegions(wallCount: number, floorCount: number) {
  useProductNodes.mockImplementation((region: string) =>
    region === "shop-wall" ? { data: nodes(wallCount) } : { data: nodes(floorCount) }
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
    expect(props.nodes).toHaveLength(ROOM_CAPACITY);
    expect(props.wallOverflowCount).toBe(0);
    expect(props.floorOverflowCount).toBe(6 + 6 - ROOM_CAPACITY);
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
