/**
 * Builds the "Buy / Enquire by email" mailto: link (FR-5.1, Phase 3 T4).
 * Pure and synchronous — no network, no DOM — so it's directly unit-testable.
 *
 * Subject matches phases/PHASE-3-shop-and-enquiry.md T4's own literal
 * example exactly: "Enquiry: Sample Belt No.5 (GBP 40)" — the plain
 * `priceAmount` number interpolated as-is (no currency-style zero-padding;
 * a whole-pound price reads as "40", not "40.00"), with the currency code
 * (not symbol) since this line sits in an email subject, not the UI.
 */
export interface BuildMailtoLinkOptions {
  /** The owner's contact address (env.VITE_OWNER_EMAIL) — never baked in here directly, so this stays swappable/testable without touching real config. */
  to: string;
  productName: string;
  priceAmount: number;
  priceCurrency: string;
  /** The product's own page — a /shop/:slug deep link, so the owner can open exactly what the visitor was looking at. */
  pageUrl: string;
  /** The product's own bullets — used only to find a "Length: …" one to
   * surface as the email's "Size" line (see extractSizeFromBullets below).
   * Optional/omittable: there's no dedicated size/SKU column on `products`
   * (docs/decisions.md D-71, client feedback: no schema migration for
   * this), so a product without a matching bullet just gets no Size line. */
  bullets?: string[];
}

export function buildMailtoSubject(productName: string, priceAmount: number, priceCurrency: string): string {
  return `Enquiry: ${productName} (${priceCurrency} ${priceAmount})`;
}

/**
 * Finds a product's own "Length: …" bullet (case-insensitive) to surface
 * as the email's "Size" line (docs/decisions.md D-71, client feedback: use
 * the product's own name as the "item number" line, and this bullet as
 * "Size" — no new SKU/size column). Returns just the value after the
 * colon, trimmed; null if no bullet matches, so callers can leave the
 * line out entirely rather than show something empty.
 */
export function extractSizeFromBullets(bullets: string[] | undefined): string | null {
  const match = bullets?.find((bullet) => /^length\s*:/i.test(bullet));
  if (!match) return null;
  return match.slice(match.indexOf(":") + 1).trim() || null;
}

export function buildMailtoBody(
  productName: string,
  priceAmount: number,
  priceCurrency: string,
  pageUrl: string,
  bullets?: string[]
): string {
  const price = new Intl.NumberFormat("en-GB", { style: "currency", currency: priceCurrency }).format(priceAmount);
  const size = extractSizeFromBullets(bullets);
  return [
    "Hi,",
    "",
    "I'd like to buy:",
    `Item: ${productName}`,
    ...(size ? [`Size: ${size}`] : []),
    `Price: ${price}`,
    pageUrl,
    "",
    "Thanks!",
  ].join("\n");
}

export function buildMailtoLink({ to, productName, priceAmount, priceCurrency, pageUrl, bullets }: BuildMailtoLinkOptions): string {
  const subject = buildMailtoSubject(productName, priceAmount, priceCurrency);
  const body = buildMailtoBody(productName, priceAmount, priceCurrency, pageUrl, bullets);
  // `to` is a plain addr-spec, not a query-string value — RFC 6068 allows
  // "@" unencoded there, and encoding it (encodeURIComponent turns "@"
  // into "%40") would just make an ordinary mailto: link look unusual for
  // no benefit. Only the subject/body query values need encoding.
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
