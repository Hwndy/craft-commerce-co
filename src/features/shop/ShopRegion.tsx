import { useMemo } from "react";

import { NodeLayer } from "@/canvas/NodeLayer";
import { Region } from "@/canvas/Region";
import type { CanvasNode, Rect } from "@/canvas/types";
import { siteMediaUrl } from "@/lib/storage";

import { PriceTagLabel } from "./PriceTagLabel";
import type { Product } from "./lib/queries";
import { useProductNodes } from "./lib/useProducts";

export interface ShopNode extends CanvasNode {
  product: Product;
}

export interface ShopRegionProps {
  region: "shop-wall" | "shop-floor";
  title: string;
  centerX: number;
  centerY: number;
  onOpenProduct?: (slug: string) => void;
}

const EMPTY_REGION_SIZE = 800;
const REGION_PADDING = 200;
const POSTER_RENDITION = "640";

/**
 * A Shop region (wall or floor) — distinct looks per T2 (FR-4.1, FR-4.2):
 * wall items get a small hung-string mark, floor items don't. Positions are
 * curated canvas_nodes (scripts/seed-products.ts), not a generative layout
 * like the collage's phyllotaxis spiral (docs/decisions.md D-48) — a real
 * shop display is arranged, not scattered.
 */
export function ShopRegion({ region, title, centerX, centerY, onOpenProduct }: ShopRegionProps) {
  const { data: productNodes } = useProductNodes(region);
  const variant = region === "shop-wall" ? "wall" : "floor";

  const { nodes, rect } = useMemo(() => {
    const emptyRect: Rect = {
      x: centerX - EMPTY_REGION_SIZE / 2,
      y: centerY - EMPTY_REGION_SIZE / 2,
      width: EMPTY_REGION_SIZE,
      height: EMPTY_REGION_SIZE,
    };
    if (!productNodes || productNodes.length === 0) {
      return { nodes: [] as ShopNode[], rect: emptyRect };
    }

    const nodes: ShopNode[] = productNodes.map((n) => ({
      id: n.nodeId,
      region,
      type: "product",
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation,
      layer: 0,
      zoomMin: 0,
      zoomMax: Number.POSITIVE_INFINITY,
      product: n.product,
    }));

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const rect: Rect = {
      x: minX - REGION_PADDING,
      y: minY - REGION_PADDING,
      width: maxX - minX + REGION_PADDING * 2,
      height: maxY - minY + REGION_PADDING * 2,
    };
    return { nodes, rect };
  }, [productNodes, centerX, centerY, region]);

  return (
    <Region id={region} title={title} x={rect.x} y={rect.y} width={rect.width} height={rect.height}>
      <RoomBackdrop variant={variant} />
      <NodeLayer
        nodes={nodes}
        renderNode={(node) => (
          <div
            style={{
              position: "absolute",
              left: node.x - rect.x,
              top: node.y - rect.y,
              width: node.width,
              height: node.height,
              transform: `rotate(${node.rotation}deg)`,
            }}
          >
            <ShopProductCard
              product={node.product}
              variant={variant}
              onOpen={onOpenProduct ? () => onOpenProduct(node.product.slug) : undefined}
            />
          </div>
        )}
      />
    </Region>
  );
}

function ShopProductCard({
  product,
  variant,
  onOpen,
}: {
  product: Product;
  variant: "wall" | "floor";
  onOpen?: () => void;
}) {
  const posterPath = product.poster?.renditions[POSTER_RENDITION];
  const posterSrc = posterPath ? siteMediaUrl(posterPath) : undefined;

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {variant === "wall" && (
        <svg aria-hidden="true" viewBox="0 0 24 16" className="mx-auto h-4 w-6 text-shop-peg">
          <circle cx="12" cy="2" r="1.5" fill="currentColor" />
          <line x1="2" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="1" />
          <line x1="22" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="1" />
          <line x1="2" y1="2" x2="2" y2="16" stroke="currentColor" strokeWidth="1" />
          <line x1="22" y1="2" x2="22" y2="16" stroke="currentColor" strokeWidth="1" />
        </svg>
      )}
      <div
        aria-hidden="true"
        className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black/10 bg-cover bg-center shadow-md"
        style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
      >
        {/* Every product carries its own turntable video (docs/00-product-
            brief.md) — this badge is a standing "tap to view" affordance,
            not a claim about one specific product's media. */}
        <span className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 fill-white">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </span>
      </div>
      <PriceTagLabel
        name={product.name}
        price={product.priceAmount}
        currency={product.priceCurrency}
        status={product.status}
        description={variant === "floor" ? product.description : undefined}
        layout={variant}
        onClick={onOpen}
        className="shrink-0"
      />
    </div>
  );
}

/**
 * The retail-signage backdrop behind the actual product cards (docs/
 * decisions.md D-71, client feedback Step 7 — rebuilt a second time,
 * after the first rebuild also missed the mark: the owner then built the
 * Product Display design themselves and shared it directly, so this
 * matches that design rather than a third guess from the PDF). One
 * dusty-pink room: its two wall faces are angled to meet at a corner
 * using real CSS 3D (`perspective` + `rotateY`) rather than a flat
 * clip-path illusion, matching how the owner's own markup builds it —
 * but both faces share the exact same `shop-wall` colour token, not two
 * different walls, which is the one thing corrected twice already. The
 * floor is the same pink family, one shade lighter (`shop-floor`), as a
 * lighting cue rather than a second colour. Purely decorative, absolutely
 * positioned to fill the region's own rect; the real product cards
 * (rendered by NodeLayer, on top of this) stay flat, same as every
 * earlier version of this backdrop — only the backdrop itself gets the
 * 3D treatment.
 */
function RoomBackdrop({ variant }: { variant: "wall" | "floor" }) {
  if (variant === "floor") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-shop-cream">
        <div className="absolute inset-0" style={{ perspective: "1800px" }}>
          <div
            className="absolute inset-0 bg-shop-floor"
            style={{ transformStyle: "preserve-3d", transform: "rotateX(14deg)", transformOrigin: "50% 0%" }}
          />
        </div>
        <span
          className="absolute bottom-10 right-10 whitespace-nowrap font-heading text-4xl font-semibold text-shop-ink/85"
          style={{ transform: "rotate(-4deg)" }}
        >
          The <em className="font-normal italic">floor</em>
        </span>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-shop-wall" style={{ perspective: "1400px" }}>
      <div
        className="absolute inset-y-0 left-0 w-1/2 bg-shop-wall shadow-[inset_-40px_0_60px_-10px_rgba(120,40,60,0.12)]"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(16deg)", transformOrigin: "100% 50%" }}
      >
        <div className="absolute left-8 top-8 flex flex-col gap-1">
          <span className="whitespace-nowrap font-heading text-3xl font-semibold text-shop-ink">
            ALL LIFE <em className="font-normal italic">shop</em>
          </span>
          <span className="whitespace-nowrap font-body text-sm italic text-shop-ink/70">
            belts from repurposed bike tyre · sand-cast aluminium buckles
          </span>
        </div>
      </div>
      <div
        className="absolute inset-y-0 right-0 w-1/2 bg-shop-wall shadow-[inset_40px_0_60px_-10px_rgba(120,40,60,0.12)]"
        style={{ transformStyle: "preserve-3d", transform: "rotateY(-16deg)", transformOrigin: "0% 50%" }}
      >
        <div className="absolute right-8 top-8 flex items-baseline gap-3 whitespace-nowrap">
          <span className="font-heading text-3xl font-semibold text-shop-ink">
            The <em className="font-normal italic">wall</em>
          </span>
          <span className="rounded-full bg-shop-gold px-2.5 py-0.5 font-heading text-xs font-semibold uppercase tracking-wide text-shop-ink">
            Sample sale
          </span>
        </div>
      </div>
    </div>
  );
}
