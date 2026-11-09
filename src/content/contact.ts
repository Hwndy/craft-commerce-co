/**
 * Static Contact content (T6, FR-6.2) — same "typed stand-in for Phase 4's
 * `pages` table" reasoning as src/content/about.ts. `intro` is the owner's
 * own words, taken verbatim from their uploaded design mockup
 * (`design_6_about_and_contact.png`).
 *
 * `socialLinks` are the mockup's own three icon slots (Instagram, YouTube,
 * a generic link/website icon) — but the mockup shows icons only, no
 * actual handles or URLs, and none have been supplied anywhere in this
 * project's docs (docs/00-product-brief.md §5 lists "social links" as
 * owner-supplied content still owed). Each `href` is deliberately `null`
 * until the owner gives a real URL (AGENTS.md rule 10: never guess a
 * handle) — Contact.tsx renders a `null`-href icon as visible but
 * disabled, the same "Coming soon" treatment T4's mailto button used for
 * "Use the form instead" before T5 built it (docs/decisions.md D-53).
 */
export interface SocialLink {
  label: string;
  icon: "instagram" | "youtube" | "link";
  href: string | null;
}

export const contactIntro = "Commissions, collaborations, press or a question about a belt.";

export const socialLinks: SocialLink[] = [
  { label: "Instagram", icon: "instagram", href: null },
  { label: "YouTube", icon: "youtube", href: null },
  { label: "Website", icon: "link", href: null },
];
