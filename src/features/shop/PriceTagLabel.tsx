import { formatGbp } from "@/components/brand/ProductLabel";
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
  onClick?: () => void;
  className?: string;
}

// Every product on this site today is the same kind of item (docs/00-
// product-brief.md: "its first product line is handcrafted belts made
// from upcycled bike tyre") — there's no dynamic "category" column on
// `products` to read this from, so it's a literal constant, matching the
// client's own mockup wording exactly (WEB_DEVELOPMENT._2.pdf page 7's
// tag: "RIYO SAMPLE #1 / BIKE TYRE BELT / £35 / Size : 49inch").
const PRODUCT_CATEGORY = "Bike tyre belt";

/**
 * The Product Display's own price-tag label (docs/decisions.md D-71,
 * client feedback Step 7) — a real tag shape (a pentagon with a punched
 * hole near its point, `clip-path`), matching the client's own mockup:
 * item name, the product category, price, and size. An earlier version
 * of this was a plain rounded card with status/sale badges — redone
 * after actually checking the mockup (WEB_DEVELOPMENT._2.pdf page 7),
 * which shows only these four lines on the tag itself; status/sale
 * information still shows elsewhere (the product overlay), not guessed
 * back onto a design that doesn't show it here.
 */
export function PriceTagLabel({ name, price, currency = "GBP", bullets, onClick, className }: PriceTagLabelProps) {
  const size = extractSizeFromBullets(bullets);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative bg-shop-gold py-2.5 pl-3.5 pr-8 text-left text-black",
        onClick && "cursor-pointer transition-transform hover:-translate-y-0.5",
        className
      )}
      style={{ clipPath: "polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%)" }}
    >
      {/* The tag's own punched hole — a ring, not a filled dot, so the
       * gold shows through it like a real cut-out would. */}
      <span
        aria-hidden="true"
        className="absolute right-[10%] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-black/30"
      />
      <ul className="list-disc space-y-0.5 pl-4 font-heading text-xs font-bold uppercase leading-tight">
        <li>{name}</li>
        <li>{PRODUCT_CATEGORY}</li>
        <li>{formatGbp(price, currency)}</li>
        {size && <li>Size : {size}</li>}
      </ul>
    </button>
  );
}
