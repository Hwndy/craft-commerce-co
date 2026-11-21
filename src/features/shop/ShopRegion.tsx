import { useState } from "react";

import { Region } from "@/canvas/Region";

import { PRODUCTS_PER_PAGE, ShopRoomScene } from "./ShopRoomScene";
import type { ProductNode } from "./lib/queries";
import { useProductNodes } from "./lib/useProducts";

export interface ShopRegionProps {
  title: string;
  centerX: number;
  centerY: number;
  onOpenProduct?: (slug: string) => void;
  /** The small, always-visible "view full list" links (accessibility/
   * keyboard/non-JS/SEO — the room's own 3D transforms aren't a great
   * screen-reader experience, so the uncapped list pages stay a real,
   * linked alternative regardless of pagination). */
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

function byDisplayOrder(a: ProductNode, b: ProductNode): number {
  return a.product.sortOrder - b.product.sortOrder || (a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0);
}

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
 * rendering* now pools both into one combined, ordered list, paginated
 * rather than hard-capped (docs/decisions.md D-82: the room now scales to
 * however many products are published, instead of silently routing
 * everything past a fixed count to an external page).
 */
export function ShopRegion({
  title,
  centerX,
  centerY,
  onOpenProduct,
  onViewAllWall,
  onViewAllFloor,
}: ShopRegionProps) {
  const { data: wallNodes, isLoading: isWallLoading } = useProductNodes("shop-wall");
  const { data: floorNodes, isLoading: isFloorLoading } = useProductNodes("shop-floor");
  const [page, setPage] = useState(0);

  // Same reasoning as the old capacity split (found in review, CodeRabbit,
  // PR #30): the two queries settle independently, so computing the
  // combined, paginated list before both have resolved could render a
  // page that's about to change under a visitor's hands the instant the
  // slower query catches up. Nothing renders until both are settled —
  // the same "nothing published here yet" state this room already shows
  // before any data arrives.
  const bothSettled = !isWallLoading && !isFloorLoading;
  const allNodes = bothSettled ? [...(wallNodes ?? []), ...(floorNodes ?? [])].sort(byDisplayOrder) : [];

  const totalPages = Math.max(1, Math.ceil(allNodes.length / PRODUCTS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const shownNodes = allNodes.slice(currentPage * PRODUCTS_PER_PAGE, (currentPage + 1) * PRODUCTS_PER_PAGE);

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
        page={currentPage}
        totalPages={totalPages}
        onPrevPage={() => setPage((p) => Math.max(0, p - 1))}
        onNextPage={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        onViewAllWall={onViewAllWall}
        onViewAllFloor={onViewAllFloor}
      />
    </Region>
  );
}
