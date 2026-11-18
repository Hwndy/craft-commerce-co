import { Region } from "@/canvas/Region";

import { ROOM_CAPACITY, ShopRoomScene } from "./ShopRoomScene";
import { useProductNodes } from "./lib/useProducts";

export interface ShopRegionProps {
  title: string;
  centerX: number;
  centerY: number;
  onOpenProduct?: (slug: string) => void;
  /** Routes past WALL_CAPACITY/FLOOR_CAPACITY's own overflow to the full list for that zone. */
  onViewAllWall?: () => void;
  onViewAllFloor?: () => void;
}

// A fixed footprint for the whole room corner (docs/decisions.md D-71,
// client feedback Step 7, third correction) — the scene lays its own
// belts out with a CSS grid/absolute positions inside each surface now,
// not from each canvas_node's own stored x/y/width/height/rotation, so
// the region's rect no longer needs computing from a node bounding box.
const SCENE_WIDTH = 1600;
const SCENE_HEIGHT = 900;

/**
 * The one Shop room — the owner's own design shows the two walls and the
 * floor together as one continuous scene, not as two separately-navigable
 * flat panels, so there's only ever one of these to mount (docs/
 * decisions.md D-71's "sixth correction" — Gallery.tsx used to mount
 * this twice, once as "shop-wall" and once as "shop-floor", each at a
 * different world position 1200 units apart, which put two full copies
 * of the identical room in the DOM at once: every product's own
 * accessible name existed twice, which is what a real CI run's Playwright
 * strict-mode violation on `getByRole("button", { name: /Sample Belt
 * No\.2/ })` caught. "shop-wall" and "shop-floor" still both exist as
 * named viewpoints — Gallery.tsx just points both cameras at this one
 * physical region now, rather than mounting a duplicate for the second
 * one to fly to.
 *
 * Client feedback, 18 Nov 2026 (docs/decisions.md D-78): "no belts on the
 * wall... merge wall+floor into one shop space." The two admin-side
 * product queries below (by `canvas_nodes.region`) stay exactly as they
 * were — that's still how an admin categorises a product, and still what
 * each zone's own "view all" list page filters by — only the *room's own
 * rendering* now pools both into one combined, capacity-sliced list for
 * the single floor grid, rather than splitting them across a wall grid
 * and a separate floor row.
 */
export function ShopRegion({
  title,
  centerX,
  centerY,
  onOpenProduct,
  onViewAllWall,
  onViewAllFloor,
}: ShopRegionProps) {
  const { data: wallNodes } = useProductNodes("shop-wall");
  const { data: floorNodes } = useProductNodes("shop-floor");

  const wall = wallNodes ?? [];
  const floor = floorNodes ?? [];
  // The room has a real, fixed visual capacity (ShopRoomScene.tsx's own
  // ROOM_CAPACITY, confirmed by screenshot, not guessed) — past it, items
  // get clipped or overlap rather than fitting, so only the capacity's
  // worth goes into the fixed floor grid; the rest is still real,
  // published, reachable content, just routed to the full list instead
  // (onViewAllWall/onViewAllFloor) rather than forced into the room. Wall
  // items fill the shared pool first, then floor items take whatever's
  // left — an arbitrary but stable tie-break, not a guess about which
  // zone's products matter more (AGENTS.md rule 10).
  const shownWall = wall.slice(0, ROOM_CAPACITY);
  const wallOverflowCount = wall.length - shownWall.length;
  const remainingCapacity = Math.max(0, ROOM_CAPACITY - shownWall.length);
  const shownFloor = floor.slice(0, remainingCapacity);
  const floorOverflowCount = floor.length - shownFloor.length;
  const shownNodes = [...shownWall, ...shownFloor];

  return (
    <Region
      id="shop-wall"
      title={title}
      x={centerX - SCENE_WIDTH / 2}
      y={centerY - SCENE_HEIGHT / 2}
      width={SCENE_WIDTH}
      height={SCENE_HEIGHT}
    >
      <ShopRoomScene
        nodes={shownNodes}
        onOpenProduct={onOpenProduct}
        wallOverflowCount={wallOverflowCount}
        floorOverflowCount={floorOverflowCount}
        onViewAllWall={onViewAllWall}
        onViewAllFloor={onViewAllFloor}
      />
    </Region>
  );
}
