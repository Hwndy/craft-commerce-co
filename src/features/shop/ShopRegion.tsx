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
      <RoomBackdrop variant={variant} width={rect.width} height={rect.height} />
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
        <svg aria-hidden="true" viewBox="0 0 24 16" className="mx-auto h-4 w-6 text-white/40">
          <circle cx="12" cy="2" r="1.5" fill="currentColor" />
          <line x1="2" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="1" />
          <line x1="22" y1="2" x2="12" y2="2" stroke="currentColor" strokeWidth="1" />
          <line x1="2" y1="2" x2="2" y2="16" stroke="currentColor" strokeWidth="1" />
          <line x1="22" y1="2" x2="22" y2="16" stroke="currentColor" strokeWidth="1" />
        </svg>
      )}
      <div
        aria-hidden="true"
        className="min-h-0 flex-1 rounded-lg bg-black/40 bg-cover bg-center"
        style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
      />
      <PriceTagLabel
        name={product.name}
        price={product.priceAmount}
        currency={product.priceCurrency}
        bullets={product.bullets}
        onClick={onOpen}
        className="shrink-0"
      />
    </div>
  );
}

const SIGNAGE_BULLETS = [
  "Belt made from repurposed bike tyre",
  "Buckle sand-cast using discarded aluminium",
];

// A one-off dark brick red for the "Product display." headline — not one
// of the client's 7 named palette swatches, so not worth a new design-
// system token for this single use. Measured against shop-wall's coral
// (#EC6136): ~3.1:1, clearing WCAG AA's large/bold-text minimum (3:1).
const SIGNAGE_HEADLINE_COLOR = "#7a1d15";

/**
 * The retail-signage backdrop behind the actual product cards — one
 * continuous pink "market stall" surface, not two differently-coloured
 * walls (docs/decisions.md D-71, client feedback Step 7, corrected: the
 * first version of this built shop-wall as two separate wall panels in
 * two different colours; the client's own mockup, WEB_DEVELOPMENT._2.pdf
 * pages 6-7, shows a single pink plane that reads as a wall here and
 * continues as the floor of the same stall in shop-floor — "a wall and
 * floor", the client's own words, not two walls). Purely decorative,
 * absolutely positioned to fill the region's own rect so it scales with
 * whatever that rect's real size ends up being, same as the product
 * cards above it. Signage text is baked in literally, not
 * product-specific — the display's own retail dressing, not something
 * scripts/seed-products.ts drives.
 *
 * Colour choices here are adapted from the mockup, not copied exactly:
 * gold text directly on this pink measures ~2.3:1 (short of WCAG AA even
 * for large text), so "Sample" sits in its own small gold chip with dark
 * text instead of gold text on pink — same gold identity, real contrast.
 * The mockup's own "10%" badge isn't reproduced as a literal percentage:
 * nothing in the real product data confirms an actual discount rate, and
 * guessing one would be guessing at pricing (AGENTS.md rule 10) — a
 * generic "Sale" flag keeps the same visual beat without inventing a number.
 */
function RoomBackdrop({ variant, width, height }: { variant: "wall" | "floor"; width: number; height: number }) {
  if (variant === "floor") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-[4%] border border-shop-teal/60 bg-shop-wall"
          style={{
            left: width * 0.05,
            top: height * 0.08,
            width: width * 0.9,
            height: height * 0.84,
            clipPath: "polygon(8% 100%, 92% 100%, 100% 0%, 0% 0%)",
          }}
        />
        {/* The mockup's own second, larger instance of the headline,
            bleeding diagonally from the wall down across the floor. */}
        <span
          className="absolute whitespace-nowrap font-heading text-3xl font-bold uppercase tracking-wide"
          style={{
            left: "48%",
            top: "8%",
            transform: "rotate(75deg)",
            transformOrigin: "top left",
            color: SIGNAGE_HEADLINE_COLOR,
          }}
        >
          Product display.
        </span>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* One continuous pink wall, angled left edge via clip-path for the
          perspective look the mockup draws — a single shape, single
          colour, not a second wall panel. */}
      <div className="absolute inset-0 bg-shop-wall" style={{ clipPath: "polygon(18% 0, 100% 0, 100% 100%, 0% 100%)" }} />

      <div className="absolute left-4 top-4 rounded-md bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
        Sale
      </div>

      <div className="absolute right-6 top-10 flex flex-col items-end gap-1.5 text-right">
        <span className="font-heading text-2xl font-bold uppercase tracking-wide" style={{ color: SIGNAGE_HEADLINE_COLOR }}>
          Product display.
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-shop-gold px-1.5 py-0.5 font-heading text-sm font-bold uppercase text-black">Sample</span>
          <span className="font-heading text-sm font-bold uppercase text-white">Sale</span>
        </div>
      </div>

      {/* Shipping/manufacturing copy along the wall's own angled left
          edge, rotated to follow it — black text (~6.3:1 on this coral,
          comfortably over WCAG AA, unlike the gold/cream alternatives
          this file tried first). */}
      <div className="absolute left-6 top-28 w-32" style={{ transform: "rotate(-18deg)", transformOrigin: "top left" }}>
        <p className="font-heading text-sm font-bold uppercase leading-tight tracking-wide text-black">Limited stock.</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-black/80">UK &amp; EU shipping only.</p>
        <ul className="mt-2 space-y-1 text-[9px] font-medium leading-tight text-black/70">
          {SIGNAGE_BULLETS.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
