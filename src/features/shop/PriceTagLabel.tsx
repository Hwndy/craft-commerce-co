import { formatGbp, STATUS_COPY, STATUS_VARIANT, type ProductStatus } from "@/components/brand/ProductLabel";
import { Badge } from "@/components/ui/badge";
import { extractSizeFromBullets } from "@/features/enquiry/lib/mailto";
import { cn } from "@/lib/utils";

export interface PriceTagLabelProps {
  /** Doubles as the client's "item number" line (docs/decisions.md D-71,
   * client feedback: no SKU column, so the product's own name is it). */
  name: string;
  price: number;
  currency?: string;
  /** Looked up for a "Length: …" bullet to show as Size — see
   * extractSizeFromBullets (mailto.ts), the same lookup the buy-email uses. */
  bullets: string[];
  status: ProductStatus;
  onSale?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * The Product Display's own price-tag-style label (docs/decisions.md
 * D-71, client feedback Step 7) — distinct from the generic ProductLabel
 * (still used by Contact/ProductOverlay/list-view fallback): shows the
 * item name doubling as an item number, a price "tag", and the product's
 * own size when it has a matching bullet. Uses the client-supplied Shop
 * palette tokens (Step 1), scoped to this section only.
 */
export function PriceTagLabel({ name, price, currency = "GBP", bullets, status, onSale, onClick, className }: PriceTagLabelProps) {
  const size = extractSizeFromBullets(bullets);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-shop-teal bg-shop-cream p-3 text-left text-black",
        onClick && "cursor-pointer transition-transform hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading text-sm font-bold uppercase tracking-wide">{name}</span>
        <span className="shrink-0 rounded-full bg-shop-gold px-2 py-0.5 font-heading text-sm font-bold">
          {formatGbp(price, currency)}
        </span>
      </div>
      {size && <span className="text-xs text-black/70">Size: {size}</span>}
      <div className="flex items-center gap-1.5">
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_COPY[status]}</Badge>
        {onSale && <Badge variant="outline">Sale</Badge>}
      </div>
    </button>
  );
}
