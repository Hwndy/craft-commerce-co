# Testing and quality

## 1. Layers

| Layer | Tools | What it covers |
|---|---|---|
| Unit | Vitest | Camera maths, culling, watched-ranges and gate, formatters, mailto builder, layout functions |
| Component | Vitest, Testing Library, jsdom | Player controls, viewer navigation and looping, product label, toggles, forms |
| Database | pgTAP via `npx supabase test db` | RLS for anonymous, authenticated non-admin and admin; storage policies |
| End to end | Playwright (Chromium and WebKit; mobile viewports) | Entry sequence, film gate, canvas navigation, viewer, enquiry flow, admin CRUD |
| Accessibility | `@axe-core/playwright` | Landing, gallery, shop, list view, admin |
| Performance | Lighthouse CI, manual traces | Budgets in `04-design-and-motion.md` |
| Manual | Real devices | iOS Safari autoplay, gestures, orientation, fullscreen layer, Android Chrome |

## 2. Fixtures

- A 20 to 30 second test video generated with ffmpeg (for example `ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=24 -f lavfi -i sine=frequency=440 -t 20 -pix_fmt yuv420p test.mp4`), encoded to HLS by the same script as the real film, committed under `e2e/fixtures/` (small) or generated in CI.
- Seed data for products and photos in `supabase/seed.sql` using placeholder media.
- Playwright config with projects: `chromium`, `webkit`, `mobile-safari` (iPhone viewport) and `mobile-chrome`.

## 3. Device matrix (manual, before each phase hand-over)

| Device | Browser | Checks |
|---|---|---|
| iPhone (recent iOS) | Safari | Autoplay path, mute toggle, landscape, gestures, no accidental page zoom |
| iPhone | In-app browsers (Instagram, WhatsApp) | Entry sequence and film still start |
| Android mid-range | Chrome | Frame rate while panning, HLS playback |
| iPad | Safari | Pinch, split view |
| Desktop | Chrome, Safari, Firefox, Edge | Wheel zoom, keyboard, drag |
| Throttled network | Any | Fast 3G / slow 4G profile: shell loads, film starts, no dead screens |

## 4. CI (GitHub Actions)

On every pull request: install, typecheck, lint, unit and component tests, build, Playwright smoke on Chromium and WebKit, `supabase db reset` plus `supabase test db` when `supabase/` changed, bundle-size check. On merge to main: deploy preview to staging. On tag: apply migrations to production, then promote.

## 5. Bug triage

Blocker: black screen, film cannot start, data exposure, wrong price shown. Fix before merge. Major: broken gesture on a reference device, layout break, accessibility failure. Fix in the phase. Minor: cosmetic. Log in `docs/known-issues.md`.
