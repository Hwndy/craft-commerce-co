import { formatGbp } from "@/components/brand/ProductLabel";
import { cn } from "@/lib/utils";

import type { Product } from "./lib/queries";

export interface PriceTagLabelProps {
  name: string;
  price: number;
  currency?: string;
  status: Product["status"];
  /** Only the floor badge has room for this — the wall chip is just name/price/status. */
  description?: string | null;
  layout: "wall" | "floor";
  onClick?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<Product["status"], string> = {
  available: "Available",
  made_to_order: "Made to order",
  sold: "Sold",
};

function StatusPill({ status }: { status: Product["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        status === "available" && "bg-shop-ink text-shop-gold",
        status === "made_to_order" && "border border-shop-ink bg-white text-shop-ink",
        status === "sold" && "border border-shop-ink/70 bg-shop-ink/10 text-shop-ink/70"
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * The Product Display's own price tag (docs/decisions.md D-71, client
 * feedback Step 7 — rebuilt to match the owner's own hand-built design,
 * shared directly, rather than a further guess from the PDF). Two
 * layouts, matching the two surfaces in ShopRegion.tsx: a rounded white
 * chip below each wall item (name · price, then a status pill), and a
 * thicker gold-ringed circular badge over each floor item (name, price,
 * a short description, then the same status pill). `status` comes
 * straight off the real `products.status` column (available/sold/
 * made_to_order) — already in the schema, just unused by this
 * component's previous version.
 */
export function PriceTagLabel({
  name,
  price,
  currency = "GBP",
  status,
  description,
  layout,
  onClick,
  className,
}: PriceTagLabelProps) {
  if (layout === "floor") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex flex-col items-center gap-1 rounded-full border-4 border-shop-gold bg-white p-4 text-center shadow-lg",
          onClick && "cursor-pointer transition-transform hover:-translate-y-0.5",
          className
        )}
      >
        <strong className="font-heading text-xs font-bold uppercase leading-tight text-shop-ink">{name}</strong>
        <span className="text-sm font-semibold text-shop-ink">{formatGbp(price, currency)}</span>
        {/* line-clamp-2: the circular badge is a fixed 150x150px box
            (ShopRoomScene.tsx) with no overflow handling of its own —
            found in review (CodeRabbit, PR #30): docs/decisions.md D-78
            now renders every product through this layout, including
            former wall-zone products whose descriptions were never shown
            (and so never reviewed against this space) before. Truncating
            here keeps the badge's own circular shape intact regardless of
            description length; the full text is still one tap away, in
            the product overlay. */}
        {description && (
          <span className="line-clamp-2 text-[11px] leading-tight text-shop-ink/70">{description}</span>
        )}
        <StatusPill status={status} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-center shadow-md",
        onClick && "cursor-pointer transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      <strong className="font-heading text-sm font-bold text-shop-ink">
        {name} · {formatGbp(price, currency)}
      </strong>
      <StatusPill status={status} />
    </button>
  );
}
