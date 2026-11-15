import { Instagram, Link2, Youtube } from "lucide-react";

import { Region } from "@/canvas/Region";
import { useFittedPanelSize } from "@/canvas/useFittedPanelSize";
import { IconButton } from "@/components/brand/IconButton";
import { contactIntro, socialLinks, type SocialLink } from "@/content/contact";
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
 * About.tsx.
 *
 * No EnquiryForm here any more (docs/decisions.md D-71, client feedback:
 * "remove the form" — UI only, the `submit-enquiry` Edge Function, the
 * `enquiries` table and its RLS policies all stay in place, dormant, not
 * deleted) — the plain mailto link below is the sole path now, same as
 * ProductOverlay's own "Use the form instead" removal.
 *
 * Sized via useFittedPanelSize, not a fixed 760×760 — found via a real CI
 * failure (mobile-chrome only): a Pixel 7's 412px-wide viewport is
 * narrower than a fixed 760px panel, so once the camera centred on it,
 * content sat permanently outside the viewport (PR #3) — see that hook's
 * own comment.
 */
export function Contact({ centerX, centerY }: ContactProps) {
  const { width, height } = useFittedPanelSize(MAX_WIDTH, MAX_HEIGHT);

  return (
    <Region id="contact" title="Contact" x={centerX - width / 2} y={centerY - height / 2} width={width} height={height}>
      <div
        data-board-scrollable
        className="flex h-full w-full flex-col gap-5 overflow-y-auto rounded-2xl bg-surface-light p-8 text-surface-light-foreground"
      >
        <div>
          <h2 className="font-heading text-3xl font-bold uppercase tracking-wide">Contact</h2>
          <p className="mt-2 text-sm text-surface-light-foreground/70">{contactIntro}</p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-surface-light-foreground/10 pt-4">
          {/* The address itself is now visible link text, not hidden
           * behind generic copy — docs/decisions.md D-71, client feedback:
           * their own new copy writes it out ("send us an email
           * serve@alllifeworks.com"), reversing D-53's earlier choice.
           * Still sourced from env.VITE_OWNER_EMAIL, not hardcoded, so the
           * visible text and the real mailto: destination can never drift
           * apart. */}
          <a
            href={`mailto:${env.VITE_OWNER_EMAIL}`}
            className="text-sm font-medium underline underline-offset-2 hover:text-primary"
          >
            Send us an email at {env.VITE_OWNER_EMAIL}
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
