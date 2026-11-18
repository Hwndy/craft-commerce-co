import { useIsMobile } from "@/hooks/use-mobile";
import { siteMediaUrl } from "@/lib/storage";

import { PriceTagLabel } from "./PriceTagLabel";
import type { ProductNode } from "./lib/queries";

const POSTER_RENDITION = "640";

// The room's own geometry — a real 3D corner (two upright walls meeting at
// 90°, one flat floor), built exactly to the owner's own spec rather than
// a flat clip-path illusion (docs/decisions.md D-71, client feedback
// Step 7, third correction). WALL_H/DEPTH/WIDTH name the surfaces' real
// sizes so the anchor's own math below stays legible instead of a wall of
// magic numbers.
const WALL_H = 470;
const DEPTH = 760;
const WIDTH = 980;

// Client feedback, 18 Nov 2026 (docs/decisions.md D-78): "no belts on the
// wall, only writing; true 3D depth with belts resting on the floor" and
// "merge wall+floor into one shop space". Every product now rests on the
// one floor plane — the walls are signage only (the back wall keeps the
// shop's own title card; the right wall is now a plain, undecorated
// surface). The room's real visual capacity, confirmed the same way as
// every earlier correction to this scene (rendering real counts against
// the fixed geometry below and screenshotting the result, not computed
// from the 3D transform math): a 4-column, 2-row floor grid holds 8 belts
// cleanly. ShopRegion.tsx caps what it passes in at this number and routes
// the rest through onViewAllWall/onViewAllFloor instead of forcing it into
// the fixed grid below.
export const ROOM_CAPACITY = 8;

interface FloorBeltProps {
  node: ProductNode;
  onOpen?: () => void;
  left: number;
  top: number;
}

/** A belt lying flat on the floor, with its round gold-ringed price sign
 * standing upright just behind it (closer to the wall, so it never covers
 * the belt — the owner's own spec: "smaller top = further from viewer"). */
function FloorBelt({ node, onOpen, left, top }: FloorBeltProps) {
  const posterPath = node.product.poster?.renditions[POSTER_RENDITION];
  const posterSrc = posterPath ? siteMediaUrl(posterPath) : undefined;

  return (
    <>
      {/* w-[190px], not the original 240px: at this grid's 220px column
          pitch, a 240px-wide poster rotated 6deg has an axis-aligned
          bounding width of ~254px — wider than the pitch, so adjacent
          posters overlapped by ~34px even with zero overflow (found in
          review, CodeRabbit, PR #30). 190px keeps that bounding width
          (~205px) comfortably under the pitch. */}
      <div
        aria-hidden="true"
        className="absolute h-[150px] w-[190px] overflow-hidden rounded-md bg-white shadow-lg"
        style={{ left, top, transform: "rotate(6deg)" }}
      >
        <div
          className="h-full w-full bg-black/10 bg-cover bg-center"
          style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
        />
      </div>
      <div
        className="absolute h-[150px] w-[150px]"
        style={{
          left: left + 30,
          top: top - 60,
          transformOrigin: "50% 100%",
          transform: "translateY(-150px) rotateX(-90deg)",
        }}
      >
        <PriceTagLabel
          name={node.product.name}
          price={node.product.priceAmount}
          currency={node.product.priceCurrency}
          status={node.product.status}
          description={node.product.description}
          layout="floor"
          onClick={onOpen}
          className="h-full w-full"
        />
      </div>
    </>
  );
}

export interface ShopRoomSceneProps {
  /** Every product shown in the room — all on the floor now (D-78). */
  nodes: ProductNode[];
  onOpenProduct?: (slug: string) => void;
  /** How many real products ShopRegion.tsx held back past ROOM_CAPACITY, by
   * which underlying admin zone they were categorised under (still two
   * separate, uncapped list pages — /list/shop-wall, /list/shop-floor —
   * D-78 only merged the room's own *visual* presentation, not the admin's
   * wall/floor categorisation or those list routes). 0 renders nothing. */
  wallOverflowCount?: number;
  floorOverflowCount?: number;
  onViewAllWall?: () => void;
  onViewAllFloor?: () => void;
}

const FLOOR_COLUMNS = 4;
const FLOOR_CELL_WIDTH = 220;
const FLOOR_CELL_HEIGHT = 190;
const FLOOR_ORIGIN_X = 40;
const FLOOR_ORIGIN_Y = 380;

/**
 * The Product Display's own 3D room corner (docs/decisions.md D-71,
 * client feedback Step 7, third correction) — built to the owner's own
 * exact spec after two earlier attempts (a flat clip-path illusion, then
 * a two-pane rotateY illusion) still didn't read as a real corner. A
 * single `perspective` scene holds one zero-size anchor; every surface
 * hangs off that anchor with its own `transform`, not a separate
 * perspective context each, so all three stay in one consistent 3D space.
 * The two wall faces are real, perpendicular planes (rotateY(-90deg) on
 * the right wall) meeting the back wall at a true corner, and the floor
 * is a third plane hinged flat off the back wall's bottom edge
 * (rotateX(90deg)) — not two differently-coloured walls stacked over a
 * trapezoid, which is the one thing corrected twice already.
 */
export function ShopRoomScene({
  nodes,
  onOpenProduct,
  wallOverflowCount = 0,
  floorOverflowCount = 0,
  onViewAllWall,
  onViewAllFloor,
}: ShopRoomSceneProps) {
  const isMobile = useIsMobile();
  const anchorTransform = `translateZ(-760px) rotateX(-16deg) rotateY(38deg)${isMobile ? " scale(0.55)" : ""}`;

  return (
    // White, not bg-shop-cream (docs/decisions.md): this fallback is only a
    // safety net for the 3D transform's own edges at odd viewport sizes —
    // Region.tsx has no background of its own, so every other region's
    // content sits directly on the Board's real white (Board.tsx). cream
    // was a visible, different-toned rectangle behind the room, reading as
    // a separate card pasted onto the canvas rather than content on it.
    <div
      className="relative h-[852px] w-full overflow-hidden bg-white"
      style={{ perspective: "1600px", perspectiveOrigin: "50% 30%" }}
    >
      <div
        className="absolute h-0 w-0"
        style={{
          left: "calc(50% + 230px)",
          top: 120,
          transformStyle: "preserve-3d",
          transform: anchorTransform,
        }}
      >
        {/* Back/left wall — sits in the anchor's own plane (z = 0), facing
            the viewer directly; no transform of its own beyond that. The
            shop's own title card is the only thing on it now (D-78): no
            belts, no "The wall" label. */}
        <div
          className="absolute bg-shop-wall-back shadow-[inset_40px_0_60px_-10px_rgba(120,40,60,0.12)]"
          style={{ left: -WIDTH, top: 0, width: WIDTH, height: WALL_H }}
        >
          <div className="absolute left-8 top-8 flex flex-col gap-1">
            <span className="whitespace-nowrap font-heading text-3xl font-semibold text-shop-ink">
              ALL LIFE <em className="font-normal italic">shop</em>
            </span>
            <span className="whitespace-nowrap font-body text-sm italic text-shop-ink/70">
              belts from repurposed bike tyre · sand-cast aluminium buckles
            </span>
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3.5 bg-[#C98F9C]" />
        </div>

        {/* Right wall — swings out from the corner toward the viewer. Now a
            plain, undecorated surface (D-78): no belts, no "The wall"
            label, no sample-sale tag — the room reads as one space rather
            than two zones meeting at a seam. */}
        <div
          className="absolute bg-shop-wall shadow-[inset_-40px_0_60px_-10px_rgba(120,40,60,0.12)]"
          style={{
            left: 0,
            top: 0,
            width: DEPTH,
            height: WALL_H,
            transformOrigin: "0 0",
            transform: "rotateY(-90deg)",
          }}
        >
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3.5 bg-[#C98F9C]" />
        </div>

        {/* Floor — hinged flat off the back wall's own bottom edge. Every
            product in the room rests here now (D-78: "true 3D depth with
            belts resting on the floor"), in one 4-column grid rather than
            split between a wall grid and a separate floor row. No "The
            floor" label either — there's only one space left to name. */}
        <div
          className="absolute bg-shop-floor shadow-[inset_0_40px_60px_-10px_rgba(120,40,60,0.12)]"
          style={{
            left: -WIDTH,
            top: WALL_H,
            width: WIDTH,
            height: DEPTH,
            transformOrigin: "100% 0",
            transform: "rotateX(90deg)",
            transformStyle: "preserve-3d",
          }}
        >
          {nodes.map((node, index) => (
            <FloorBelt
              key={node.nodeId}
              node={node}
              onOpen={onOpenProduct ? () => onOpenProduct(node.product.slug) : undefined}
              left={FLOOR_ORIGIN_X + (index % FLOOR_COLUMNS) * FLOOR_CELL_WIDTH}
              top={FLOOR_ORIGIN_Y + Math.floor(index / FLOOR_COLUMNS) * FLOOR_CELL_HEIGHT}
            />
          ))}
          {/* Pinned to the floor's own top-right corner, in the strip above
              FLOOR_ORIGIN_Y (380) — the grid never places a product there
              regardless of count, unlike the previous bottom-right
              placement: found in review (CodeRabbit, PR #30) that with a
              full 8-item grid, the bottom-right corner is exactly where
              the last poster sits, so the buttons covered part of it. */}
          {wallOverflowCount > 0 && (
            // docs/decisions.md D-78: the room only has room for
            // ROOM_CAPACITY belts total — this routes the rest of what was
            // categorised "wall" to the full, uncapped list
            // (ListRegion.tsx's shop section) instead of silently losing
            // them off the edge of the fixed grid.
            <button
              type="button"
              onClick={onViewAllWall}
              className="absolute right-10 top-4 whitespace-nowrap rounded-full border border-shop-ink/40 bg-white/80 px-3 py-1 font-body text-xs font-semibold text-shop-ink underline-offset-2 hover:underline"
            >
              +{wallOverflowCount} more (wall) — view all
            </button>
          )}
          {floorOverflowCount > 0 && (
            // Same reasoning, for whatever was categorised "floor".
            <button
              type="button"
              onClick={onViewAllFloor}
              className="absolute right-10 top-12 whitespace-nowrap rounded-full border border-shop-ink/40 bg-white/80 px-3 py-1 font-body text-xs font-semibold text-shop-ink underline-offset-2 hover:underline"
            >
              +{floorOverflowCount} more (floor) — view all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
