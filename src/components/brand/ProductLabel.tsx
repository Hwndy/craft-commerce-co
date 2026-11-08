import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ProductStatus = "available" | "made_to_order" | "sold";

export interface ProductLabelProps {
  name: string;
  /** Amount in the currency's major unit (e.g. 40 for £40.00) — matches phases/PHASE-3-shop-and-enquiry.md T2's own wording. */
  price: number;
  currency?: string;
  description?: string;
  status: ProductStatus;
  className?: string;
}

const STATUS_COPY: Record<ProductStatus, string> = {
  available: "Available",
  made_to_order: "Made to order",
  sold: "Sold",
};

/** badge.tsx's own variants — "outline" for made-to-order, "secondary" (muted) for sold. */
const STATUS_VARIANT: Record<ProductStatus, "default" | "outline" | "secondary"> = {
  available: "default",
  made_to_order: "outline",
  sold: "secondary",
};

export function formatGbp(amount: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

/**
 * Name/price/description/status card for a shop product — the mockup's
 * Shop Wall and Shop Floor cards (docs/decisions.md D-45), built for
 * phases/PHASE-3-shop-and-enquiry.md T2's own spec. Cream surface, dark
 * text — the one real new token from D-45 (--surface-light).
 */
export function ProductLabel({ name, price, currency = "GBP", description, status, className }: ProductLabelProps) {
  return (
    <div className={cn("rounded-xl bg-surface-light p-4 text-surface-light-foreground", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-heading font-bold">{name}</span>
        <span className="font-heading font-bold">{formatGbp(price, currency)}</span>
      </div>
      {description && <p className="mt-1 text-sm text-surface-light-foreground/70">{description}</p>}
      <Badge variant={STATUS_VARIANT[status]} className="mt-2">
        {STATUS_COPY[status]}
      </Badge>
    </div>
  );
}
