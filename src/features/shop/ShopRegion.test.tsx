import { act } from "react";
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
import { PRODUCTS_PER_PAGE } from "./ShopRoomScene";

function product(name: string, sortOrder: number): Product {
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
    sortOrder,
    poster: null,
  };
}

function nodes(count: number, prefix: string, sortOrderOffset = 0): ProductNode[] {
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `${prefix}${i}`,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    product: product(`${prefix}${i}`, sortOrderOffset + i),
  }));
}

function mockRegions(wallNodes: ProductNode[], floorNodes: ProductNode[]) {
  useProductNodes.mockImplementation((region: string) =>
    region === "shop-wall" ? { data: wallNodes, isLoading: false } : { data: floorNodes, isLoading: false }
  );
}

function latestProps() {
  return sceneSpy.mock.calls.at(-1)![0];
}

describe("ShopRegion pagination (docs/decisions.md D-82)", () => {
  // The room now scales to the real catalogue instead of hard-capping it
  // (D-82 superseded D-78's ROOM_CAPACITY/overflow split) — under one
  // page's worth, everything shows on page 1 with no pagination controls.
  it("passes every product straight through on a single page when under PRODUCTS_PER_PAGE", () => {
    mockRegions(nodes(2, "wall-"), nodes(2, "floor-", 2));
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = latestProps();
    expect(props.nodes).toHaveLength(4);
    expect(props.page).toBe(0);
    expect(props.totalPages).toBe(1);
  });

  it("orders the combined wall+floor catalogue by product.sortOrder, not by zone", () => {
    // Deliberately seeded so neither zone's own query order matches the
    // real display order — only sortOrder should decide it.
    const wall = [product("wall-a", 3), product("wall-b", 0)].map((p, i) => ({
      nodeId: `wall-${i}`,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      product: p,
    }));
    const floor = [product("floor-a", 1), product("floor-b", 2)].map((p, i) => ({
      nodeId: `floor-${i}`,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      product: p,
    }));
    mockRegions(wall, floor);
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    expect(latestProps().nodes.map((n: ProductNode) => n.product.name)).toEqual([
      "wall-b",
      "floor-a",
      "floor-b",
      "wall-a",
    ]);
  });

  it("paginates once the combined catalogue exceeds PRODUCTS_PER_PAGE, and Prev/Next page through it", () => {
    mockRegions(nodes(PRODUCTS_PER_PAGE, "wall-"), nodes(1, "floor-", PRODUCTS_PER_PAGE));
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    let props = latestProps();
    expect(props.totalPages).toBe(2);
    expect(props.page).toBe(0);
    expect(props.nodes).toHaveLength(PRODUCTS_PER_PAGE);
    expect(props.nodes.map((n: ProductNode) => n.nodeId)).not.toContain("floor-0");

    act(() => props.onNextPage());
    props = latestProps();
    expect(props.page).toBe(1);
    expect(props.nodes.map((n: ProductNode) => n.nodeId)).toEqual(["floor-0"]);

    act(() => props.onPrevPage());
    props = latestProps();
    expect(props.page).toBe(0);
  });

  // Same reasoning as D-78's original version of this test (found in
  // review, CodeRabbit, PR #30): the two queries settle independently, so
  // computing the combined, paginated list before both have resolved could
  // render a page that's about to change under a visitor's hands the
  // instant the slower query catches up.
  it("renders nothing until both the wall and floor queries have settled", () => {
    useProductNodes.mockImplementation((region: string) =>
      region === "shop-wall" ? { data: undefined, isLoading: true } : { data: nodes(3, "floor-"), isLoading: false }
    );
    render(<ShopRegion title="Shop" centerX={0} centerY={0} />);

    const props = latestProps();
    expect(props.nodes).toEqual([]);
    expect(props.totalPages).toBe(1);
  });

  it("forwards onViewAllWall/onViewAllFloor through to the scene untouched", () => {
    mockRegions(nodes(1, "wall-"), nodes(1, "floor-", 1));
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

    const props = latestProps();
    expect(props.onViewAllWall).toBe(onViewAllWall);
    expect(props.onViewAllFloor).toBe(onViewAllFloor);
  });
});
