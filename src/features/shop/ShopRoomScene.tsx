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
// surface). The room's real visual capacity — a 4-column, 2-row floor
// grid holds this many belts cleanly — is now a *page* size, not a hard
// cap (docs/decisions.md D-82): ShopRegion.tsx paginates the full,
// ordered catalogue through this many at a time, instead of silently
// routing everything past a fixed count to an external page. Confirmed
// by real measured geometry (e2e/shop-geometry.spec.ts), not by eye —
// the room is a true CSS `perspective` scene, so flat 2D pixel math
// (column pitch vs. poster width) doesn't reliably predict the final
// on-screen bounding boxes once perspective foreshortening applies; every
// earlier "fits at N" claim here was an assumption, not a measurement.
export const PRODUCTS_PER_PAGE = 8;

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
      {/* Sized and spaced by real measurement (e2e/shop-geometry.spec.ts),
          not flat 2D pixel math (docs/decisions.md D-82) — this room is a
          true CSS `perspective` scene, so a poster's local size and the
          grid's local pitch don't map onto final on-screen bounding boxes
          by simple rotated-rectangle arithmetic the way the previous fix
          (190px, found in review, CodeRabbit, PR #30) assumed; foreshort-
          ening also makes the *column* pitch shrink faster than the poster
          width as column index increases, so a uniform local pitch that's
          merely "wider than one poster" at column 0 can still overlap at
          column 3. These values were increased/shrunk until the e2e spec's
          real getBoundingClientRect() measurements showed zero overlap
          across every column and row this grid actually renders. */}
      <div
        aria-hidden="true"
        data-testid={`floor-poster-${node.nodeId}`}
        className="absolute h-[98px] w-[122px] overflow-hidden rounded-md bg-white shadow-lg"
        style={{ left, top, transform: "rotate(6deg)" }}
      >
        <div
          className="h-full w-full bg-black/10 bg-cover bg-center"
          style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
        />
      </div>
      <div
        className="absolute h-[110px] w-[110px]"
        style={{
          left: left + 20,
          top: top - 70,
          transformOrigin: "50% 100%",
          transform: "translateY(-140px) rotateX(-90deg)",
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
  /** This page's products — all on the floor now (D-78). */
  nodes: ProductNode[];
  onOpenProduct?: (slug: string) => void;
  /** 0-indexed current page and the total page count, for the Prev/Next
   * controls (docs/decisions.md D-82) — hidden entirely when there's only
   * one page, same spirit as the old overflow buttons only appearing once
   * there was somewhere else to go. */
  page: number;
  totalPages: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  /** Small, always-visible links to the full, uncapped list for each
   * admin-side zone (still two separate pages — /list/shop-wall,
   * /list/shop-floor — D-78 only merged the room's own *visual*
   * presentation, not the admin's wall/floor categorisation or those list
   * routes) — kept for keyboard/screen-reader/non-JS visitors the room's
   * own 3D transforms don't serve well, not gated behind an overflow
   * count any more (nothing below is ever capped past the point of being
   * unreachable now that pagination covers the whole catalogue). */
  onViewAllWall?: () => void;
  onViewAllFloor?: () => void;
}

const FLOOR_COLUMNS = 4;
const FLOOR_CELL_WIDTH = 400;
const FLOOR_CELL_HEIGHT = 450;
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
  page,
  totalPages,
  onPrevPage,
  onNextPage,
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
          {/* Pinned to the floor's own top corners, in the strip above
              FLOOR_ORIGIN_Y (380) — the grid never places a product there
              regardless of count, unlike the previous bottom-right
              placement: found in review (CodeRabbit, PR #30) that with a
              full 8-item grid, the bottom-right corner is exactly where
              the last poster sits, so controls there covered part of it.
              docs/decisions.md D-82: the room now paginates instead of
              hard-capping, so these are Prev/Next + a page indicator
              (left) rather than an overflow count, and the "view all"
              links (right) are a permanent accessibility/SEO affordance,
              not something that only appears past a capacity. */}
          {totalPages > 1 && (
            <div className="absolute left-10 top-4 flex items-center gap-2 whitespace-nowrap rounded-full border border-shop-ink/40 bg-white/80 px-3 py-1 font-body text-xs font-semibold text-shop-ink">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={page <= 0}
                aria-label="Previous products"
                className="disabled:opacity-40"
              >
                ←
              </button>
              <span>
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={onNextPage}
                disabled={page >= totalPages - 1}
                aria-label="Next products"
                className="disabled:opacity-40"
              >
                →
              </button>
            </div>
          )}
          {onViewAllWall && (
            <button
              type="button"
              onClick={onViewAllWall}
              className="absolute right-10 top-4 whitespace-nowrap rounded-full border border-shop-ink/40 bg-white/80 px-3 py-1 font-body text-xs font-semibold text-shop-ink underline-offset-2 hover:underline"
            >
              View all (wall)
            </button>
          )}
          {onViewAllFloor && (
            <button
              type="button"
              onClick={onViewAllFloor}
              className="absolute right-10 top-12 whitespace-nowrap rounded-full border border-shop-ink/40 bg-white/80 px-3 py-1 font-body text-xs font-semibold text-shop-ink underline-offset-2 hover:underline"
            >
              View all (floor)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
