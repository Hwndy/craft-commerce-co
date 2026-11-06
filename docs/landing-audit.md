# Landing page audit (Phase 1, T1)

No behaviour change was made for this audit. It answers D-04 and records the real values the rest of Phase 1 builds on.

## 1. How the seal is built (answers D-04)

The seal is **not** CSS, an image sequence, a live canvas, three.js or Lottie. It is a **pre-rendered video loop**:

- `src/pages/LandingVideo.tsx` renders a single full-screen `<video autoPlay loop muted playsInline>` with sources `public/videos/all_life_1.webm` (4.7 MB) and `public/videos/all_life_1.mp4` (2.4 MB), poster `public/videos/all_life_poster.jpg` (104 KB).
- The "spin" is baked into the video itself (a gold star/compass emblem with "ALL LIFE" lettering arced above it, on a black background) — there is no separate 3D model or animation to control at runtime.
- Playback is forced via a `loadeddata`/`canplay` listener that calls `video.play()` repeatedly for autoplay reliability; this is the only JS driving it.
- **Consequence for T6 (`SealController`)**: control is limited to what the `<video>` element exposes — `playbackRate` (for the 1x→6x speed ramp) and swapping the source/overlaying effects for the "finer luminous form" at the end. There is no uniform/shader to drive and no frame-stepping API. `playbackRate` changes on a looping low-frame-rate render may look stepped rather than smooth — worth a quick visual check once the entry sequence is wired up, and flagged rather than assumed.
- No separate "finer luminous form" asset exists anywhere in the repo. Per the Phase 1 brief's own fallback, T6 will build it as a CSS cross-fade/blur/`mix-blend-mode: screen` treatment behind `SealController.setLuminous()`, and this is recorded as an owner follow-up below, not silently decided.

## 2. Current route setup

`src/App.tsx`: `BrowserRouter` with `/` → `LandingVideo`, `/home` → `Home` (generic Lovable template: Navigation/Hero/About/Products/Testimonials/Blog sections, unrelated to the Gallery concept and not part of the ALL LIFE site), `*` → `NotFound`. No `/gallery` route exists yet.

## 3. "Click to enter" control

A click handler exists on the landing `<div>` (`onClick={() => navigate("/home")}`) but **is commented out**, along with a mobile "TAP TO ENTER" hint. The element already has `role="button"`, `tabIndex={0}` and `aria-label="Enter ALL LIFE"`, so it's keyboard-reachable even disabled. Phase 1 T6 reuses this element and wires it to the entry sequence instead of a direct navigate.

## 4. Fonts, colours and spacing actually in use

From `src/index.css` (the real tokens — supersede the placeholders in `docs/04-design-and-motion.md` §2):

| Token | Real value | Placeholder in docs/04 |
|---|---|---|
| `--background` | `hsl(0 0% 8%)` (near-black) | `#000000` |
| `--foreground` | `hsl(0 0% 98%)` | `--ink` `#F5F1E6` |
| `--primary` / `--accent` | `hsl(51 100% 50%)` (vivid gold-yellow) | `--gold` `#C9A64B` |
| `--radius` | `0.75rem` | 12 px cards |

No custom font family is loaded (`index.html` sets no font link); shadcn/Tailwind defaults (system font stack) are in effect. No separate "heavy slab serif" asset exists for board labels — flagged for the owner per `docs/04-design-and-motion.md` §2.

**Action taken:** none yet — `docs/04-design-and-motion.md`'s placeholder tokens are left as-is per the brief ("mark them for owner approval"); real values are recorded here for Phase 1 implementation to reference directly.

## 5. Dependencies actually used vs. `package.json`

- `App.css` (Vite template leftover, logo-spin keyframes etc.) is **not imported anywhere** (`main.tsx` only imports `index.css`) — dead file, generator leftover.
- `lovable-tagger`'s `componentTagger()` is wired into `vite.config.ts` for `mode === 'development'` only; does not affect production builds. Left in place per AGENTS.md rule 2 ("remove generator leftovers only after asking") — flagged, not removed.
- All other `package.json` dependencies correspond to code actually in use (shadcn/ui primitives, TanStack Query, react-hook-form, Zod, etc.) via the generic `Home.tsx` template sections; none of the Phase 1 build-kit dependencies (`@supabase/supabase-js`, `zustand`, `@use-gesture/react`, `framer-motion`/`gsap`, `hls.js`, `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `@axe-core/playwright`, `@sentry/react`) are installed yet — added in T2 onward.

## 6. Lighthouse mobile baseline

Not measured in this session: no network egress to run Lighthouse/Chrome DevTools audits against a public URL is available here, and a meaningful mobile-throttled trace needs the real device profile rather than this container. **Action needed:** run `npx lighthouse http://localhost:4173 --preset=mobile` (or Lighthouse CI once added in T2) against the preview build and record the four scores here before Phase 1 is marked done.

## 7. Deployment settings

No `vercel.json` exists yet (added in T2). The repo has no CI workflow yet (added in T2). Package manager artefacts present: both `bun.lockb` and `package-lock.json` exist; per AGENTS.md rule, npm is the project's chosen package manager and neither lockfile is deleted without asking the owner.

## 8. Generator leftovers found

- `src/App.css` — unused, dead file (Vite template default). Not deleted in this audit; flagged for removal once the owner confirms (AGENTS.md rule 2 covers the landing page specifically, not generically unused files, so this is a smaller, separate cleanup call).
- `lovable-tagger` dev-mode plugin in `vite.config.ts` — intentionally left; affects dev builds only.
- Generic Lovable template content in `src/pages/Home.tsx` and its six `src/components/ui/*-section.tsx` components (hero/about/products/testimonials/blog/footer/navigation) — not the ALL LIFE site; superseded by the canvas/Gallery work in this phase and Phase 2–3, but not deleted yet since nothing replaces `/home` until later phases wire up the board. Left in place.

## 9. Build and baseline

- `npm ci && npm run build` — green, unchanged (`dist/index.html` 1.07 kB, CSS 66.81 kB / gzip 11.83 kB, JS 360.92 kB / gzip 113.93 kB).
- Reference screenshots captured via the preview build at `127.0.0.1:4173`: `e2e/baseline/landing-mobile-390x844.png`, `e2e/baseline/landing-desktop-1440x900.png`. Nothing visual changed from this audit.

## Owner follow-ups opened by this audit

- No "finer luminous form" asset exists; T6 will use a CSS-based treatment unless the owner supplies a dedicated asset or 3D model (see Phase 1 brief's risk note on the ~24–40 extra creative-dev hours if a new asset is needed).
- No board-label serif font exists; confirm with the owner before introducing a new family (per `docs/04-design-and-motion.md` §2).
- Real brand tokens (near-black `hsl(0 0% 8%)`, gold `hsl(51 100% 50%)`) differ from the build kit's placeholder hex values; recommend updating `docs/04-design-and-motion.md` once the owner confirms these are final.
- Lighthouse mobile baseline still needs to be run and recorded once a reachable preview URL exists (e.g. after the Vercel preview deploy in T14, or manually against localhost before then).
