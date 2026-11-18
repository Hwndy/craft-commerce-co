import { Region } from "@/canvas/Region";

import { FLOOR_CAPACITY, ShopRoomScene, WALL_CAPACITY } from "./ShopRoomScene";
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
  // WALL_CAPACITY/FLOOR_CAPACITY, confirmed by screenshot, not guessed) —
  // past it, items get clipped or overlap rather than fitting, so only the
  // capacity's worth goes into the fixed 3D grids; the rest is still real,
  // published, reachable content, just routed to the full list instead
  // (onViewAllWall/onViewAllFloor) rather than forced into the room.
  const shownWall = wall.slice(0, WALL_CAPACITY);
  const wallOverflowCount = wall.length - shownWall.length;
  const shownFloor = floor.slice(0, FLOOR_CAPACITY);
  const floorOverflowCount = floor.length - shownFloor.length;

  // Real wall product count (within capacity) drives the split — not a
  // hardcoded "2 and 3" (AGENTS.md rule 10: don't invent content to match
  // a mockup's own placeholder slot count).
  const splitIndex = Math.ceil(shownWall.length / 2);
  const backWallNodes = shownWall.slice(0, splitIndex);
  const rightWallNodes = shownWall.slice(splitIndex);

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
        backWallNodes={backWallNodes}
        rightWallNodes={rightWallNodes}
        floorNodes={shownFloor}
        onOpenProduct={onOpenProduct}
        wallOverflowCount={wallOverflowCount}
        floorOverflowCount={floorOverflowCount}
        onViewAllWall={onViewAllWall}
        onViewAllFloor={onViewAllFloor}
      />
    </Region>
  );
}
