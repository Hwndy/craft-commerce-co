# Phase 2: Full canvas engine and the circular photo collage

**Goal.** The board becomes a real spatial canvas (pan, zoom, inertia, semantic zoom, guided mode, minimap, deep links, list view) and the Gallery gets its circular photo collage with a full-screen viewer.

**Read first:** `AGENTS.md`, `docs/00-product-brief.md` (FR-3, FR-8), `docs/02-canvas-spec.md` (all), `docs/03-data-and-security.md` (migration 0002), `docs/04-design-and-motion.md`, `docs/05-testing-and-quality.md`, `src/canvas/CLAUDE.md`. Phase 1 must be accepted.

**Cost phase:** the rest of Phase 1 in the PRD/TRD (packages 5, 15, 16).

## Owner inputs needed

- [ ] Photo-shoot images (full resolution) with a title and date for each, and the shoot names.
- [ ] The board layout intent: confirm the mind-map arrangement (D-14) and which regions exist at launch.
- [ ] Approval of region names and labels.

## Checklist

### T1. Board architecture review
- [x] Re-read `docs/02-canvas-spec.md`; list deviations from Phase 1's shell and fix the shell before building on it. *(Done as part of planning this phase: `types.ts`/`math.ts`/`store.ts`/`Board.tsx`/`Region.tsx`/`viewpoints.ts` all already match §1–3 exactly — zero deviations. The only spec items not yet present (gestures, culling, semantic zoom) are explicitly this phase's own job, not shell bugs.)*
- [x] Record the animation library decision (D-17) if not yet taken. *(Already decided in Phase 1 T6 — framer-motion. Nothing to redo.)*
- **Done when:** Added `src/canvas/CLAUDE.md` (referenced by both phase briefs' "Read first" lists, missing until now). ✅

### T2. Gestures and camera control (FR-8.2, FR-8.7)
- [x] Pointer drag, wheel and trackpad pinch (`ctrlKey` wheel), two-finger touch pinch about the midpoint, double-tap or double-click zoom, inertia with exponential decay, zoom and pan limits, a Home control. *(`useBoardGestures.ts`: @use-gesture/react drag/wheel/pinch, exponential-decay inertia on release, double-click zoom. `useBoardKeyboard.ts`: arrows pan, +/- zoom, 0 = home, Esc zooms out one level, focusin flies the camera to centre whatever gained keyboard focus.)*
- [x] Keyboard control as in the spec. Prevent Safari gesture events and overscroll on the board only. *(`Board.tsx`: `overscroll-behavior:none` and `gesturestart/change/end` prevented while mounted, cleaned up on unmount.)*
- [x] Unit tests for zoom about a point and limit clamping; Playwright tests for wheel zoom and drag. *(`exponentialDecay`/`clampPanToBounds` added to `math.ts`, 36 total math tests. `e2e/canvas-gestures.spec.ts`: wheel zoom, drag, double-click, keyboard — against `/gallery`'s real Board, not `/dev/canvas` — see the note below.)*
- **Found during implementation:** Vite's `import.meta.env.DEV` is tied to the build *command*, not `--mode` — no `vite build` invocation (any mode, including the project's own `build:dev` script) ever ships it `true`, only `vite dev` does. So `/dev/canvas`/`/dev/film` can never be reached by the `webServer` (`vite preview`) Playwright's config runs tests against, in CI or locally — they were only ever manually verified against `npm run dev` in Phase 1, never covered by a real, repeatable spec. `canvas-gestures.spec.ts` tests gestures against `/gallery`'s real Board instead (after completing the same genuine watch-through `gate.spec.ts` uses) — more realistic anyway, and actually runs in CI.
- **Done when:** ✅ `npm run typecheck`/`lint`/`test`/`build` all green; `npx playwright test` green across all 4 projects (webkit-family skipped per D-27, same as Phase 1). Bundle: main chunk unchanged (189.72 KB gzip); gesture code landed in the lazily-loaded Region chunk (11.08→11.68 KB gzip across T2/T3), well under the 80 KB canvas-engine budget.

### T3. Culling and levels of detail (FR-8.3, FR-8.10)
- [x] Grid index; mount only nodes near the viewport; levels of detail by on-screen width; video pause and unload off screen. *(`culling.ts`: uniform grid (`cellsForRect`) and the actual filter, `cullNodes` — keeps nodes whose rect intersects the visible rect + 25% margin, pure and unit tested (13 tests). `levelOfDetail.ts`: on-screen-width → placeholder/thumbnail/full per the spec's 80px/400px thresholds (5 tests). `NodeLayer.tsx` wires both together: mounts only culled nodes at their LOD, recomputing on camera change but throttled (150ms), via a manual store subscription — not the React hook `Board.tsx`'s own rAF loop deliberately avoids. "Video pause/unload off screen" is infrastructure for future video-type nodes — no such nodes exist yet to wire it to.)*
- [x] A dev overlay (toggle with a query flag) showing frame time, mounted node count and zoom. *(`DebugOverlay.tsx`, behind `?debug=1`, polling the `data-camera-*`/`data-node-layer-count` DOM attributes `Board.tsx`/`NodeLayer.tsx` already write rather than subscribing to the camera store itself.)*
- **Found during implementation:** `NodeLayer.test.tsx` is this repo's first real component test (Testing Library + jsdom) — needed adding `src/test` to `tsconfig.strict.json`'s `include`, since jest-dom's matcher types augment Vitest's `expect` via `src/test/setup.ts`, which the strict tsconfig's typecheck wasn't compiling at all until now.
- **Done when:** ✅ 144→160 unit tests total across T3/T4, all green; CI genuinely green ([run #17](https://github.com/Hwndy/craft-commerce-co/actions/runs/42334688537)). `NodeLayer`/`culling`/`levelOfDetail` aren't wired into any page yet (no real node data exists until T7/T8) — zero bundle-size impact, confirmed (nothing imports them yet, so nothing is bundled).

### T4. Semantic zoom and entering regions (FR-8.3)
- [x] Region enter/leave logic (70% coverage and 250 ms stability), region full-screen modes registered by features. *(`regionEntry.ts`: pure `regionCoverageFraction`/`hasEnteredRegion` — fraction of the viewport's on-screen area a region rect covers (8 tests). `useRegionEntry.ts`: the stateful hook — debounces on every camera-store change, only (re-)evaluates coverage once `stableMs` (default 250ms) passes with no further change, matching "camera has been stable for 250ms" precisely rather than polling on an interval (3 component tests, including an explicit debounce-vs-poll check).)*
- **Deliberately not wired into Gallery.tsx yet.** Gallery's `reveal()`/`hide()` today trigger on route mount, not camera position — there's no real camera-driven navigation between regions until T5's viewpoints/routing exist, and Gallery's region rect (800×600 at the T12 placeholder viewpoint) doesn't actually reach 70% coverage at zoom 1 in portrait (checked: ~35%). Rewiring the trigger now would mean re-tuning already-shipped, fully-tested Phase 1 geometry for no real benefit — correctly sizing regions and wiring entry/leave into every feature lands with T5 once real navigation exists.
- **Done when:** ✅ `npm run typecheck`/`lint`/`test`/`build`/`test:e2e` all green (160 unit tests, 38 e2e). No bundle impact (unwired infrastructure, confirmed via build output). Real wiring and real-device verification follow once T5's navigation is in place.

### T5. Viewpoints, guided mode, minimap, URL sync (FR-8.4 to FR-8.6, FR-8.5)
- [ ] Migration `0002_canvas_and_photos` with RLS and pgTAP tests; seed the viewpoints (`landing`, `gallery`, `collage`, `shop`, `about`, `contact`) and the region nodes.
- [ ] Guided mode with Next/Previous, a progress indicator, and the first-visit default (D-12). Explore/Guided switch.
- [ ] Minimap, region title, Home control.
- [ ] Route to viewpoint and camera to route rules from the spec; back and forward replay viewpoints. Live-region announcements.

### T6. List view and accessibility (FR-8.9)
- [ ] `/list` and `/list/:region` render all content as semantic HTML. A "List view" button is always visible.
- [ ] Focusable nodes in reading order; focus moves the camera; reduced-motion makes flights instant.

### T7. Photo data and seed pipeline
- [ ] `scripts/seed-photos.ts <folder> <setTitle>`: for each image create WebP renditions at 256, 640, 1280 and 2048 px (use `sharp` in this local script only; add it as a dev dependency and record it), a tiny blur data URL, upload to `site-media/photos/<set>/`, insert `media`, `photo_sets` and `photos` rows, and read titles and dates from a `photos.csv` next to the images.
- [ ] Generate placeholder photos for development.

### T8. Collage region (FR-3.1, FR-3.2, FR-3.7)
- [ ] Deterministic circular layout: golden-angle (phyllotaxis) spiral, `angle = i * 137.508 degrees`, `radius = c * sqrt(i)`, tilt seeded from the photo id within about plus or minus 8 degrees, small size variation. Layout function in `src/features/collage/lib/layout.ts` with unit tests (stable output for the same ids). Keep "strips" as an alternate layout value.
- [ ] Render photos as canvas nodes with blur placeholders and 256 px thumbnails; swap to 640 px when zoomed in.
- [ ] Decide DOM versus PixiJS using the rule in the spec (over about 300 images, or under 50 fps on the reference device). Record the decision and measurements.

### T9. Photo viewer (FR-3.3 to FR-3.6)
- [ ] Full-screen overlay opened from a photo node: image at 1280 or 2048 px by screen size, title and date caption, X button and Escape to close, swipe, arrow keys and on-screen arrows to cycle in order, last photo loops to the first, preload the next two, focus trap, return focus on close.
- [ ] Deep links `/gallery/photo/:id`; browser back closes the viewer.
- [ ] Gesture polish: swipe velocity, tap to toggle UI, pinch inside the viewer does not move the board.

### T10. Gate integration
- [ ] After the film is unlocked, Continue flies to the collage viewpoint. Direct visits to `/gallery/photo/:id` still require the gate only if the film was never watched on this device (D-07); record the behaviour.

### T11. Quality pass
- [ ] Playwright: wheel zoom, drag, keyboard navigation, guided Next/Previous visiting every region, deep link opens at the right camera, viewer loop and Escape, list view parity, axe clean.
- [ ] Performance traces on the reference devices: panning at or near 60 fps with the full collage; memory stays stable over a 2-minute session.
- [ ] Run `/finish-phase 2`.

## Acceptance criteria

| # | Criterion | Maps to |
|---|---|---|
| B1 | Drag, wheel, pinch and double-tap move and zoom the board smoothly with inertia and limits; no accidental page zoom, pull-to-refresh or edge swipe on iPhone. | FR-8.2, FR-8.7 |
| B2 | Zooming into a region progressively reveals detail and enters its full-screen mode; zooming out leaves it. | FR-8.3 |
| B3 | Guided mode visits every region in order; Explore and Guided switch without losing position; first visit defaults to Guided. | FR-8.4 |
| B4 | Every region, photo and product route opens at the right camera; back and forward replay views; shared links work. | FR-8.5 |
| B5 | A minimap, region title and Home control are present. | FR-8.6 |
| B6 | The list view exposes all content to keyboard and screen-reader users; reduced motion removes flights. | FR-8.9 |
| B7 | Only nodes near the viewport are mounted; 60 fps panning on the reference devices with the full collage. | FR-8.10 |
| B8 | The collage is circular, zoomable, lazy loaded and uses renditions; viewer cycles in order, loops last to first, shows title and date, closes with X and Escape. | FR-3.1 to FR-3.7 |
| B9 | RLS tests for the new tables pass; CI is green; budgets hold. | AGENTS rule 5 |

## Starter prompt

```
/start-phase 2
```
