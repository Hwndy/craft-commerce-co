# Design language, motion and budgets

## 1. Principle

**Light from darkness.** The site opens in black with a gold seal and ends each interaction in light. Everything that moves should feel like a camera moving through a studio or a board, not like a web page scrolling.

## 2. Tokens

**Confirmed (D-45)** — the owner supplied a full design mockup covering every screen (board, gallery, shop, about/contact, mobile). Its computed colours (extracted via Playwright, not eyeballed) match what was already live in `src/index.css` almost exactly, resolving the placeholders below:

| Token | Real value | CSS variable |
|---|---|---|
| `--bg` | `hsl(0 0% 8%)` ≈ `#141414` | `--background` |
| `--ink` | `hsl(0 0% 98%)` ≈ `#FAFAFA` | `--foreground` |
| `--gold` | `hsl(51 100% 50%)` = `#FFD900` | `--primary` / `--accent` |
| `--light` | `#FFFFFF` | (unchanged) |
| Warm card surface (new) | `hsl(45 32% 93%)` ≈ `#F2EFE6` | `--surface-light` / `--surface-light-foreground` — product cards, the Contact panel |
| Radius | 12 px for cards, 999 px for pills | `--radius` (0.75rem) |

`--accent-cyan` (`#7FD8E6`) does not appear anywhere in the confirmed design — dropped, not used.

**Shop/Product Display palette (D-71)** — a client feedback document (14 Nov 2026) supplied a separate 7-swatch palette ("ALLIFEWORKS 2026 COLOUR PALETTE"), used only in that document's Product Display mockup — nothing in the document shows it replacing the site-wide dark/gold tokens above. Scoped to the rebuilt Product Display section only (client feedback Step 7); additive:

| Token | Hex | CSS variable | Mockup usage |
|---|---|---|---|
| Wall orange | `#EC6136` | `--shop-wall` | back/side wall panels |
| Accent pink | `#F10044` | `--shop-accent-pink` | secondary signage accent |
| Cream | `#F7F2F3` | `--shop-cream` | floor/base surface |
| Teal | `#398D99` | `--shop-teal` | wall border strokes |
| Green | `#77C290` | `--shop-green` | unassigned secondary accent |
| Sky blue | `#6EB2D1` | `--shop-sky` | unassigned secondary accent |
| Gold/yellow | `#FFD455` | `--shop-gold` | price-tag fill |

Type: **confirmed** — Roboto Slab for headings/board labels (`--font-heading`), Inter for body/UI text (`--font-body`), both loaded via Google Fonts in `index.html` with `font-display: swap`.

## 3. Entry sequence timing (Phase 1, superseded 17 Nov 2026 — real transition video)

The fixed millisecond timing table that used to live here (seal speed ramp, CSS rays, a light-plane opacity curve, a CSS "luminous form" swap) described CSS standing in for an asset that didn't exist yet. The owner has since supplied that asset directly: `star_bust_transition.mp4`/`.webm` (1920×1080, 30fps, ~7.77s, no audio) — the seal spinning, then bursting into rays that flood the frame to white, filmed rather than approximated.

Current behaviour:

- **Click** — the idle seal loop (`all_life_1.mp4`/`.webm`) swaps to the real transition clip, played once, muted, start to finish. A Skip control is visible from 0 s.
- **Clip's own `ended` event** (with a safety-net timeout slightly longer than its ~7.77s runtime, in case `ended` never fires) hands off straight to the Gallery/film layer — there's no fixed-duration timer driving the cut any more; it's whenever the real footage actually finishes.
- **Reduced motion** — unchanged: a 400 ms cross-fade straight to the Gallery, no transition video played at all, no rays, no speed ramp.

Photosensitivity: the transition clip was checked frame-by-frame before this swap — one smooth, monotonic brightening over ~7s, not a repeated flash. No element may flash more than 3 times per second; re-check by eye if the asset is ever re-encoded or replaced.

## 4. Camera flights

Duration 900 to 2200 ms scaled by distance; ease-in-out cubic; zoom interpolated in log space. Reduced motion: instant. Never animate more than the world transform and an optional opacity.

## 5. Components to build once and reuse

`Button`, `IconButton`, `Pill`, `Slider` (accessible), `Overlay` (focus trap, Escape to close, scroll lock), `Toast`, `Spinner`/`BufferingRing`, `RegionLabel`, `ProductLabel`, `Caption`. Use shadcn primitives where they fit and restyle with tokens.

## 6. Accessibility

- WCAG 2.2 AA: contrast, focus visible, target size 24 px minimum (aim for 44 px on touch).
- Every interactive node has a name; images have alt text from `alt_text`; the film supports captions.
- Overlays trap focus and return it on close. Announce region changes in a polite live region.
- Provide the list view on every page.

## 7. Performance budgets

| Metric | Budget |
|---|---|
| LCP (shell, mid-range Android, 4G) | under 2.5 s |
| Initial JS (gzip, before lazy chunks) | under 250 KB |
| Canvas engine chunk | under 80 KB gzip |
| Entry-sequence chunk | under 60 KB gzip (excluding any 3D library) |
| Film start (5 Mbps) | under 3 s to first frame |
| Panning | 60 fps target, never below 50 fps on the reference devices |
| Lighthouse mobile | performance 85 or more; accessibility, best practices and SEO 95 or more |

Reference devices: an iPhone 12 or newer, and a 2021 mid-range Android phone. Record measured numbers in each phase's hand-over.
