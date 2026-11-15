import { useIsMobile } from "@/hooks/use-mobile";
import { siteMediaUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

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

interface WallBeltProps {
  node: ProductNode;
  onOpen?: () => void;
}

/** A wall-mounted belt: pin + string, a white framed photo (greyscale once
 * sold), and the wall's own pill price tag underneath. */
function WallBelt({ node, onOpen }: WallBeltProps) {
  const posterPath = node.product.poster?.renditions[POSTER_RENDITION];
  const posterSrc = posterPath ? siteMediaUrl(posterPath) : undefined;
  const sold = node.product.status === "sold";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-shop-peg" />
      <span aria-hidden="true" className="h-3.5 w-0.5 bg-shop-peg" />
      <div className="relative h-28 w-40 overflow-hidden rounded-md bg-white shadow-md">
        <div
          aria-hidden="true"
          className={cn("h-full w-full bg-black/10 bg-cover bg-center", sold && "grayscale")}
          style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
        />
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-2.5 w-2.5 fill-white">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </span>
      </div>
      <PriceTagLabel
        name={node.product.name}
        price={node.product.priceAmount}
        currency={node.product.priceCurrency}
        status={node.product.status}
        layout="wall"
        onClick={onOpen}
      />
    </div>
  );
}

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
      <div
        aria-hidden="true"
        className="absolute h-[150px] w-[240px] overflow-hidden rounded-md bg-white shadow-lg"
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
  /** Products placed on the back/left wall — first share of the wall zone. */
  backWallNodes: ProductNode[];
  /** Products placed on the right wall — the rest of the wall zone. */
  rightWallNodes: ProductNode[];
  floorNodes: ProductNode[];
  onOpenProduct?: (slug: string) => void;
}

const FLOOR_COLUMNS = 3;
const FLOOR_CELL_WIDTH = 280;
const FLOOR_CELL_HEIGHT = 220;
const FLOOR_ORIGIN_X = 50;
const FLOOR_ORIGIN_Y = 420;

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
export function ShopRoomScene({ backWallNodes, rightWallNodes, floorNodes, onOpenProduct }: ShopRoomSceneProps) {
  const isMobile = useIsMobile();
  const anchorTransform = `translateZ(-760px) rotateX(-16deg) rotateY(38deg)${isMobile ? " scale(0.55)" : ""}`;

  return (
    <div
      className="relative h-[852px] w-full overflow-hidden bg-shop-cream"
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
            the viewer directly; no transform of its own beyond that. */}
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
          <div className="absolute left-10 top-32 grid grid-cols-2 gap-10">
            {backWallNodes.map((node) => (
              <WallBelt
                key={node.nodeId}
                node={node}
                onOpen={onOpenProduct ? () => onOpenProduct(node.product.slug) : undefined}
              />
            ))}
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3.5 bg-[#C98F9C]" />
        </div>

        {/* Right wall — swings out from the corner toward the viewer. */}
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
          <div className="absolute right-6 top-8 flex items-baseline gap-3 whitespace-nowrap">
            <span className="font-heading text-3xl font-semibold text-shop-ink">
              The <em className="font-normal italic">wall</em>
            </span>
            <span className="rounded-full bg-shop-gold px-2.5 py-0.5 font-heading text-xs font-semibold uppercase tracking-wide text-shop-ink">
              Sample sale
            </span>
          </div>
          <div className="absolute left-8 top-32 grid grid-cols-3 gap-8">
            {rightWallNodes.map((node) => (
              <WallBelt
                key={node.nodeId}
                node={node}
                onOpen={onOpenProduct ? () => onOpenProduct(node.product.slug) : undefined}
              />
            ))}
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-3.5 bg-[#C98F9C]" />
        </div>

        {/* Floor — hinged flat off the back wall's own bottom edge. */}
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
          {floorNodes.map((node, index) => (
            <FloorBelt
              key={node.nodeId}
              node={node}
              onOpen={onOpenProduct ? () => onOpenProduct(node.product.slug) : undefined}
              left={FLOOR_ORIGIN_X + (index % FLOOR_COLUMNS) * FLOOR_CELL_WIDTH}
              top={FLOOR_ORIGIN_Y + Math.floor(index / FLOOR_COLUMNS) * FLOOR_CELL_HEIGHT}
            />
          ))}
          <span
            className="absolute bottom-10 right-10 whitespace-nowrap font-heading text-4xl font-semibold text-shop-ink/85"
            style={{ transform: "rotate(-4deg)" }}
          >
            The <em className="font-normal italic">floor</em>
          </span>
        </div>
      </div>
    </div>
  );
}
