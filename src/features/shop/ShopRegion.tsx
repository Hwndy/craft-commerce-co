import { useMemo } from "react";

import { NodeLayer } from "@/canvas/NodeLayer";
import { Region } from "@/canvas/Region";
import type { CanvasNode, Rect } from "@/canvas/types";
import { ProductLabel } from "@/components/brand/ProductLabel";
import { siteMediaUrl } from "@/lib/storage";

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
      <ProductLabel
        name={product.name}
        price={product.priceAmount}
        currency={product.priceCurrency}
        description={product.description ?? undefined}
        status={product.status}
        onSale={product.onSale}
        onClick={onOpen}
        className="shrink-0"
      />
    </div>
  );
}
