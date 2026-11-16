import { Region } from "@/canvas/Region";

import { ShopRoomScene } from "./ShopRoomScene";
import { useProductNodes } from "./lib/useProducts";

export interface ShopRegionProps {
  region: "shop-wall" | "shop-floor";
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
 * Both Shop regions ("shop-wall" and "shop-floor") render the exact same
 * 3D room corner — the owner's own design shows the two walls and the
 * floor together as one continuous scene, not as two separately-navigable
 * flat panels, so there is nothing distinct left to show per region.
 * Keeping both as real Board regions (rather than deleting one) leaves
 * every existing viewpoint/minimap-rectangle/guided-path/e2e reference to
 * "shop-wall"/"shop-floor" by key untouched; flying to either one lands on
 * the identical, complete room.
 */
export function ShopRegion({ region, title, centerX, centerY, onOpenProduct }: ShopRegionProps) {
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
      id={region}
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
