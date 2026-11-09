/**
 * Static About content (T6, FR-6.1) — a typed stand-in for the real
 * `pages` table Phase 4 adds (docs/03-data-and-security.md §4: `pages.key
 * = 'about'`, admin-editable). Until then this file is the one place the
 * About region's copy lives; replace its values (and make the page
 * fetch from `pages` instead) when Phase 4 lands — don't duplicate this
 * copy elsewhere.
 *
 * `tagline` and `purpose` are the owner's own words, taken verbatim from
 * their uploaded design mockup (`design_6_about_and_contact.png`) — not
 * guessed (AGENTS.md rule 10). `brandStory` is explicitly NOT the owner's
 * copy: the same mockup shows it as its own bracketed placeholder,
 * "[Brand story — owner's own words, editable in the admin.]", which this
 * mirrors rather than inventing real brand-story prose. `tags` are the
 * mockup's own category chips, also verbatim.
 */
export interface AboutContent {
  tagline: string;
  purpose: string;
  brandStory: string;
  isBrandStoryPlaceholder: boolean;
  tags: string[];
}

export const aboutContent: AboutContent = {
  tagline: "Light entering from darkness.",
  purpose:
    "ALL LIFE expresses inner drives and urges, moulds wishes into practical, visible works that serve people, and turns life experiences — inner and outer — into recognitions that lead to new resolves and finished work.",
  brandStory: "Brand story — owner's own words, editable in the admin.",
  isBrandStoryPlaceholder: true,
  tags: ["Artworks", "Photography", "Sound", "Forms", "Design", "Experience"],
};
