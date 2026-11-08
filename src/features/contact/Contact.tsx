import { Instagram, Link2, Youtube } from "lucide-react";

import { Region } from "@/canvas/Region";
import { useFittedPanelSize } from "@/canvas/useFittedPanelSize";
import { IconButton } from "@/components/brand/IconButton";
import { formatGbp } from "@/components/brand/ProductLabel";
import { contactIntro, socialLinks, type SocialLink } from "@/content/contact";
import { EnquiryForm } from "@/features/enquiry/components/EnquiryForm";
import { useProducts } from "@/features/shop/lib/useProducts";
import { env } from "@/lib/env";

export interface ContactProps {
  centerX: number;
  centerY: number;
}

const MAX_WIDTH = 760;
const MAX_HEIGHT = 760;

const SOCIAL_ICONS: Record<SocialLink["icon"], typeof Instagram> = {
  instagram: Instagram,
  youtube: Youtube,
  link: Link2,
};

/**
 * The Contact region (T6, FR-6.2) — a cream panel directly on the board,
 * same "real content at its own world position, no modal" reasoning as
 * About.tsx. Reuses EnquiryForm (T5) exactly as docs/decisions.md D-54
 * anticipated ("a standalone component... so T6's Contact region can
 * reuse it for a general enquiry, no productId") — the only addition is
 * `productOptions`, so a visitor here can say which product they mean
 * the way the mockup's own "About a product" dropdown does, which
 * ProductOverlay's own usage never needs (it already knows the product).
 *
 * Sized via useFittedPanelSize, not a fixed 760×760 — found via a real CI
 * failure (mobile-chrome only): a Pixel 7's 412px-wide viewport is
 * narrower than a fixed 760px panel, so once the camera centred on it,
 * the left-aligned "Send enquiry" button sat permanently outside the
 * viewport (PR #3) — see that hook's own comment.
 */
export function Contact({ centerX, centerY }: ContactProps) {
  const { data: products } = useProducts();
  const productOptions = (products ?? []).map((p) => ({
    id: p.id,
    label: `${p.name} — ${formatGbp(p.priceAmount, p.priceCurrency)}`,
  }));
  const { width, height } = useFittedPanelSize(MAX_WIDTH, MAX_HEIGHT);

  return (
    <Region id="contact" title="Contact" x={centerX - width / 2} y={centerY - height / 2} width={width} height={height}>
      <div className="flex h-full w-full flex-col gap-5 overflow-y-auto rounded-2xl bg-surface-light p-8 text-surface-light-foreground">
        <div>
          <h2 className="font-heading text-3xl font-bold uppercase tracking-wide">Contact</h2>
          <p className="mt-2 text-sm text-surface-light-foreground/70">{contactIntro}</p>
        </div>

        <EnquiryForm productOptions={productOptions} />

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-light-foreground/10 pt-4">
          {/* The visible text names the address's purpose, not the address
           * itself — the mockup's own "Email ALL LIFE directly" treatment.
           * The real address still has to live in the href for mailto: to
           * work at all (unavoidable, same as T4's own Buy/Enquire link,
           * docs/decisions.md D-53) — this just avoids ALSO spelling it out
           * a second time as plain link text here. */}
          <a
            href={`mailto:${env.VITE_OWNER_EMAIL}`}
            className="text-sm font-medium underline underline-offset-2 hover:text-primary"
          >
            Email ALL LIFE directly
          </a>

          <div className="flex items-center gap-2">
            {socialLinks.map((social) => {
              const Icon = SOCIAL_ICONS[social.icon];
              const className =
                "border-surface-light-foreground/20 bg-transparent text-surface-light-foreground hover:bg-surface-light-foreground/10";
              return social.href ? (
                <IconButton key={social.label} aria-label={social.label} size="sm" className={className} asChild>
                  <a href={social.href} target="_blank" rel="noreferrer noopener">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                </IconButton>
              ) : (
                <IconButton
                  key={social.label}
                  aria-label={`${social.label} (coming soon)`}
                  size="sm"
                  disabled
                  title="Coming soon"
                  className={className}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              );
            })}
          </div>
        </div>
      </div>
    </Region>
  );
}
