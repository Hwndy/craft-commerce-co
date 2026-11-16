import { Region } from "@/canvas/Region";

import { ShopRoomScene } from "./ShopRoomScene";
import { useProductNodes } from "./lib/useProducts";

export interface ShopRegionProps {
  title: string;
  centerX: number;
  centerY: number;
  onOpenProduct?: (slug: string) => void;
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
export function ShopRegion({ title, centerX, centerY, onOpenProduct }: ShopRegionProps) {
  const { data: wallNodes } = useProductNodes("shop-wall");
  const { data: floorNodes } = useProductNodes("shop-floor");

  const wall = wallNodes ?? [];
  // Real wall product count drives the split — not a hardcoded "2 and 3"
  // (AGENTS.md rule 10: don't invent content to match a mockup's own
  // placeholder slot count).
  const splitIndex = Math.ceil(wall.length / 2);
  const backWallNodes = wall.slice(0, splitIndex);
  const rightWallNodes = wall.slice(splitIndex);

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
        floorNodes={floorNodes ?? []}
        onOpenProduct={onOpenProduct}
      />
    </Region>
  );
}
