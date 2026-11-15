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
        status={product.status}
        onSale={product.onSale}
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

/**
 * The pseudo-3D "2 walls + floor" retail-signage scene behind the actual
 * product cards (docs/decisions.md D-71, client feedback Step 7 mockup) —
 * purely decorative background, absolutely positioned to fill the
 * region's own rect exactly like the cards above it, so it scales with
 * whatever that rect's real size ends up being rather than a fixed pixel
 * size. Signage text is baked in literally, not product-specific — it's
 * the display's own retail dressing, the same every time this region is
 * visited, not something scripts/seed-products.ts drives.
 *
 * shop-wall hosts both the "back wall" and "side wall" planes the mockup
 * shows (hung items read as being inside a room with two visible walls);
 * shop-floor is the simpler floor plane the mockup shows laid-out items
 * standing on, with no signage of its own — every signage line in the
 * mockup belongs to a wall.
 */
function RoomBackdrop({ variant, width, height }: { variant: "wall" | "floor"; width: number; height: number }) {
  if (variant === "floor") {
    return (
      <div
        aria-hidden="true"
        className="absolute rounded-[10%] border border-shop-teal/60 bg-shop-cream/90"
        style={{
          left: width * 0.05,
          top: height * 0.1,
          width: width * 0.9,
          height: height * 0.8,
          clipPath: "polygon(8% 100%, 92% 100%, 100% 0%, 0% 0%)",
        }}
      />
    );
  }

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* Back wall. Black text throughout, not the cream/gold the mockup's
          own colours might suggest — checked against WCAG 2.2 AA (4.5:1
          for this size of text): cream-on-coral measures ~3:1 and
          gold-on-coral ~2.3:1, both short; black-on-coral measures ~6.3:1,
          comfortably over (AGENTS.md rule 6: accessibility isn't optional
          polish, even for signage text that's otherwise purely decorative). */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-start gap-1 bg-shop-wall pt-6 text-black"
        style={{ clipPath: "polygon(0 0, 78% 0, 78% 100%, 0 100%)" }}
      >
        <span className="font-heading text-2xl font-bold uppercase tracking-wide">Product display</span>
        <span className="font-heading text-sm font-bold uppercase tracking-widest">Sample sale</span>
      </div>
      {/* Side wall — angled via clip-path to read as a second plane, not a
          flat continuation of the back wall. Black text again: measured
          ~4.8:1 on this pink, cream would only measure ~3.9:1. */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-start gap-1 bg-shop-pink pl-10 pt-6 text-left text-black"
        style={{ clipPath: "polygon(78% 0, 100% 0, 100% 100%, 78% 100%)" }}
      >
        <div className="w-28 -rotate-6">
          <p className="font-heading text-sm font-bold uppercase leading-tight tracking-wide">Limited stock</p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-black/90">UK &amp; EU shipping only</p>
          <ul className="mt-2 space-y-1 text-[9px] leading-tight text-black/80">
            {SIGNAGE_BULLETS.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
