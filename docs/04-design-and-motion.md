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

Type: **confirmed** — Roboto Slab for headings/board labels (`--font-heading`), Inter for body/UI text (`--font-body`), both loaded via Google Fonts in `index.html` with `font-display: swap`.

## 3. Entry sequence timing (Phase 1)

| Time (s) | Event |
|---|---|
| 0.0 | Click. Button fades. Film element primed. Preloads begin. |
| 0.0 to 2.5 | Seal speed ramps 1x to 6x (ease-in). Faint rays begin around 0.8 s. |
| 1.0 to 4.0 | Rays grow in length and brightness. |
| 3.0 to 5.5 | Light plane opacity ramps 0 to 1 (monotonic, no flashing). |
| 4.5 to 5.5 | Seal swaps to the finer luminous form while the screen is bright. |
| 5.5 to 6.1 | Hold at full light. |
| 6.1 to 7.3 | Light fades to the Gallery; camera flight ends on the film layer. |

Total about 7 s. A Skip control is visible from 0 s. Reduced motion: 400 ms cross-fade, no rays, no speed ramp.

Photosensitivity: no element may flash more than 3 times per second, and luminance changes are smooth ramps. Check with a frame-by-frame review before release.

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
