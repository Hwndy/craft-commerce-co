# Phase 1: Landing page to film play

**Goal.** A visitor on the live landing page clicks "Click to enter", watches the spin-up, rays and light flood, and arrives at the Gallery where the film plays full screen with working controls, high-speed scrubbing, landscape support and a first-watch gate. This phase also lays the foundations (tooling, CI, Supabase, canvas shell, film pipeline) that all later phases use.

**Read first:** `AGENTS.md`, `docs/00-product-brief.md` (FR-1, FR-2, FR-8.1), `docs/01-architecture.md`, `docs/02-canvas-spec.md` (sections 1 to 3 and 7), `docs/03-data-and-security.md` (migration 0001), `docs/04-design-and-motion.md`, `docs/05-testing-and-quality.md`, `docs/decisions.md`, `src/features/film/CLAUDE.md`, `src/canvas/CLAUDE.md`, `supabase/CLAUDE.md`.

**Cost phase:** part of Phase 1 in the PRD/TRD (packages 1, 3, 4, 9 and the first parts of 10 and 15).

## Owner inputs needed before starting

- [ ] Film source file (MP4/MOV) and, if available, captions (`.vtt`).
- [ ] What the seal is built with and its source files (answers D-04); the "finer luminous" form, if it is a separate asset.
- [ ] Supabase staging project created (URL and anon key; the service-role key kept only on the developer machine) and Vercel project access.
- [ ] Confirmation of the production address (alllifeworks.com or the Vercel preview address).
- [ ] Brand tokens if they differ from what the landing page already uses.

If an input is missing, build with a generated test film and placeholder luminous form, flag it in the hand-over, and do not block.

## Scope

In: repo audit, tooling and CI, Supabase base (migration 0001), film encode/upload scripts, canvas shell with one flight, entry sequence, film player with gate, Gallery route, tests, preview deploy.
Out: pan/zoom gestures, minimap, guided mode, collage, shop, admin, prerendering (later phases). Do not add placeholder UI for them except where stated.

## Checklist

### T1. Audit and baseline (no behaviour change)
- [x] Write `docs/landing-audit.md`: how the seal is built and animated (CSS, image sequence, video, canvas, three.js, Lottie), file paths and sizes, the current route setup, whether a "Click to enter" control already exists, fonts, colours and spacing tokens, dependencies actually used, Lighthouse mobile baseline (performance, accessibility, best practices, SEO), deployment settings, and generator leftovers (for example `lovable-tagger`). *(Lighthouse mobile baseline still not measured — no reachable public preview URL in this environment; flagged as a follow-up in the audit.)*
- [x] Record answers or open questions in `docs/decisions.md` (D-04).
- [x] `npm ci && npm run build` passes unchanged. Take reference screenshots of the landing page at 390x844 and 1440x900 into `e2e/baseline/`.
- **Done when:** the audit exists, the build is green, and nothing visual has changed. ✅

### T2. Tooling and CI
- [x] Add scripts named in `AGENTS.md`. Add Vitest with jsdom and Testing Library; Playwright with projects `chromium`, `webkit`, `mobile-safari`, `mobile-chrome`; `@axe-core/playwright`. *(axe-core wired into specs in T13, per the brief's own structure.)*
- [x] Enable TypeScript `strict` for new code. If enabling it globally breaks the generated code for more than a day, add `tsconfig.strict.json` that covers `src/canvas`, `src/features`, `src/lib` and use it in `npm run typecheck`; record this in `decisions.md`. *(D-19.)*
- [x] GitHub Actions workflow: install, typecheck, lint, test, build, Playwright smoke.
- [x] `.env.example`, `src/lib/env.ts` (Zod-validated), `vercel.json` with the SPA rewrite and basic security headers.
- **Done when:** CI is green on a pull request and a smoke test opens `/` and sees the landing page. ✅ (verified locally: typecheck, lint, test, build and a chromium Playwright run all green; webkit could not be exercised in this sandbox — see hand-over.)

### T3. Supabase foundation
- [x] `npx supabase init`; link staging; add migration `0001_core_and_film` from `docs/03-data-and-security.md`; `supabase/seed.sql` with no secrets.
- [x] Generate `src/lib/database.types.ts`; create `src/lib/supabase.ts` with the typed client.
- [x] pgTAP tests in `supabase/tests/0001_core_and_film.test.sql` for anonymous, authenticated non-admin and admin.
- **Done when:** `npx supabase db reset` and `npx supabase test db` pass locally, and the migration is applied to staging. ✅ (15/15 pgTAP assertions pass locally; migration applied to staging `xuengnzfnywlbvcjmwie` via the Management API rather than `db push` — see D-21 for why and how it's kept consistent with the CLI's own bookkeeping.)

### T4. Film asset pipeline
- [x] `scripts/encode-hls.sh <input.mp4> <outdir>`: for each rung of the ladder (360p about 800 kbps, 720p about 2.8 Mbps, 1080p about 5 Mbps) encode H.264 and AAC into 6-second HLS segments with `-hls_playlist_type vod`, force keyframes every 6 seconds (`-force_key_frames "expr:gte(t,n_forced*6)"`), write a `master.m3u8` listing each rendition with `BANDWIDTH` and `RESOLUTION`, a poster JPEG at 10% of the duration, and a tiled sprite of thumbnails every 5 seconds (for example with the `fps` and `tile` filters) plus `sprite.json` (`cols`, `rows`, `w`, `h`, `interval`).
- [x] `scripts/upload-film.ts`: reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`; uploads the output folder to `site-media/film/<id>/` with correct content types (`application/vnd.apple.mpegurl` for playlists, `video/mp2t` for `.ts`), long immutable `cacheControl` for segments and a short one for playlists; inserts the `media` row (kind `hls`, status `ready`, duration, sprite meta) and a `gallery_film` row (`published = true`, `version = 1`).
- [x] `scripts/README.md` with the exact commands and how to replace the film (bump `version`).
- [x] Generate and upload a 20 to 30 second **test film** and use it for development and tests. *(Used the real film instead — the owner supplied it directly; see D-23. A short synthetic test film is still needed before T9/T10/T13's gate tests.)*
- **Done when:** the playlist URL from Supabase Storage plays in desktop Safari, Chrome (via hls.js) and on an iPhone. ⚠️ Verified `master.m3u8`/variant playlists are publicly reachable and structurally valid; actual browser/device playback not yet checked (no GUI/device in this session) — manual check still needed per AGENTS.md rule 7.

### T5. Canvas shell (minimum)
- [x] `src/canvas/types.ts`, `math.ts` (screen/world conversion, fit-to-rect, flight interpolation), `store.ts` (Zustand camera store), `Board.tsx` (viewport and world with a single transform), `Region.tsx`, `viewpoints.ts` (a registry with `landing` and `gallery` for now), `flyTo()` with reduced-motion handling.
- [x] No pan/zoom gestures yet, but the API must allow them to be added in Phase 2 without changes to callers. *(`Board`/`store` expose nothing gesture-specific; Phase 2 adds `@use-gesture/react` handlers that call the same `flyTo`/`setCamera`.)*
- [x] Unit tests for every function in `math.ts`. *(23 tests, including round-trips, monotonicity and boundary cases.)*
- **Done when:** a dev-only route can fly the camera between two test regions at 60 fps. ✅ Verified at `/dev/canvas` (dev-only, `import.meta.env.DEV`-gated): the world transform animates smoothly from 0px to -2000px over the flight, not an instant jump (checked via Playwright against the real dev server). Frame-rate itself needs a real-device trace later (T13/T2 budget measurement), not verifiable headlessly in this sandbox.

### T6. Entry sequence (FR-1)
- [x] `src/features/entry/`: an `EntryOrchestrator` with a state machine `idle -> accelerating -> burst -> flood -> reveal -> done`, driven by one timeline that follows the timings table in `docs/04-design-and-motion.md`. *(Pure `computeEntryState(elapsedMs)`, 14 unit tests including the floodOpacity-never-decreases-before-reveal property; `useEntryOrchestrator` drives it from rAF.)*
- [x] A `SealController` interface (`setSpeed(multiplier)`, `setLuminous(amount 0..1)`, `destroy()`) and one implementation chosen from the audit: **video** (the audit found a `<video>`, not CSS/canvas/three.js — D-04). Does not rewrite how the seal looks; wraps the existing `LandingVideo.tsx` video element.
- [x] `RaysCanvas` (2D canvas, additive rays, intensity 0 to 1, DPR capped at 2) and `FloodOverlay` (radial gradient, opacity ramp that never decreases until the reveal — enforced by `computeEntryState` and tested). No flashing above 3 Hz (both are smooth continuous ramps, no strobing).
- [x] "Click to enter" button and a Skip control. Reused the landing page's existing clickable div (its `onClick` was commented out; wired it to the orchestrator instead of a direct navigate) rather than adding a new button.
- [x] Preload during the ramp: `queryClient.prefetchQuery(['film'])` plus the poster image and master playlist warmed in the HTTP cache (`src/features/entry/preload.ts`, reusing `src/features/film/lib/queries.ts`, which T7 builds the player around). *(Dynamic import of "the Gallery chunk" not done — that chunk doesn't exist until T12's route; nothing to import yet.)*
- [x] No luminous asset exists (confirmed in the audit); implemented the "finer luminous form" as `SealController.setLuminous` applying CSS `brightness`/`blur` with `mix-blend-mode: screen` directly to the video element. Owner follow-up already recorded in `docs/landing-audit.md` and `decisions.md`.
- [x] Reduced motion: no `RaysCanvas` mounted at all, speed stays at 1x, a single 400 ms opacity cross-fade (`computeReducedMotionState`).
- **Done when:** the sequence runs in about 7 seconds with no loading gap, can be skipped, and degrades under reduced motion. ✅ Verified against the real dev server (Playwright): full-motion path completes and navigates at ~7.3s, Skip navigates immediately, reduced-motion path completes at ~400ms; no console/page errors on any path. `/gallery` doesn't exist until T12, so navigation there 404s for now — expected, not a bug (see D-24).

### T7. Film player core (FR-2.6, FR-2.7)
- [x] `src/features/film/FilmPlayer.tsx` and `lib/hls.ts`: `hls.js` when supported, native HLS on Safari and iOS, `destroy()` on unmount, fatal-error recovery with a visible retry, buffering ring, branded poster, captions track when present. Lazy-loaded behind the `/dev/film` route (see note below) so `hls.js` never enters the initial bundle.
- [x] `useFilm()` query: reads the published `gallery_film` joined with its ready `media` row via supabase-js; no service key.
- **Done when:** the test film plays on desktop Chrome, desktop Safari and iPhone Safari, and recovers after a network drop. ✅ Chrome: verified against a local Supabase stack (real staging host can't be browser-tested from this sandbox — see D-25) — `hls.js` loads the ladder, picks a rendition, `currentTime` advances, zero errors, real decoded frames confirmed. ⚠️ Desktop Safari/WebKit can't run in this sandbox at all (missing system libs, same limitation as T2); iPhone Safari needs a real device. Both need a manual check before this phase is called done (AGENTS.md rule 7). Network-drop recovery is implemented (`attachHls`'s NETWORK_ERROR/MEDIA_ERROR auto-retry, then a visible Retry button) but not exercised under a real throttled/dropped connection yet.
- **Added a dev-only `/dev/film` route** (same pattern as T5's `/dev/canvas`, lazy-loaded) to verify the player before T12 builds the real Gallery route.

### T8. Autoplay and priming (FR-2.1)
- [x] `FilmController.prime()` runs inside the "Click to enter" handler: create or reuse the single `<video>`, set `playsInline`, call `play()` and immediately `pause()` so the element is unlocked by the gesture. After the reveal call `start()`. *(Built as `src/features/film/filmControllerStore.ts`, a Zustand store rather than a class, matching the project's existing `src/canvas/store.ts` pattern. The single `<video>` element lives in the new `FilmStage` component, mounted once at the app root — outside the router — so navigating from `/` to `/gallery` never recreates it; this also sets up T11's "no remount on rotation" for free.)*
- [x] Fallback chain when `play()` rejects with `NotAllowedError`: start muted and show a "Tap for sound" pill; if that also fails, show a large play button. Never a black screen. Controlled by `VITE_FILM_AUTOSTART`.
- [x] Direct visits to `/gallery` (no gesture) show the poster with a large play button. *(Logic implemented — `FilmStage` always attempts `start()` on reveal, which correctly falls through to the play-button fallback with no prior `prime()`; the actual `/gallery` route doesn't exist until T12, so this can't be end-to-end tested as a real page visit yet.)*
- **Done when:** the three paths are tested, and the real-iPhone result is written in the hand-over. ✅ Autoplay (the primed path) verified end-to-end in a real browser against a local Supabase stack: click → entry sequence → reveal → unmuted autoplay actually starts, `currentTime` advancing, zero errors. Muted and play-button fallback paths verified via 11 unit tests in `filmControllerStore.test.ts` (mocked `play()` rejection — more reliable than fighting real browser autoplay heuristics in an automated test, which don't reliably simulate "zero user activation"). ⚠️ Real-iPhone result still outstanding — needs a manual check per AGENTS.md rule 7 before this phase is done; nothing in this session can substitute for it.

### T9. Controls and scrubbing (FR-2.3)
- [x] Play/pause, mute and a volume slider. Detect whether `volume` is writable (iOS ignores it) and hide the slider there. *(Probed once per video element by writing a different value and checking it stuck; iOS can't be tested from this sandbox, but the detection itself is unit-testable logic — verified correct on desktop Chromium, where it's writable and the slider shows.)*
- [x] Scrub bar as an accessible slider (`aria-valuetext` in minutes and seconds), showing buffered ranges and sprite thumbnails while dragging. During a drag, apply `currentTime` changes at most once per animation frame, and use `fastSeek` where the browser has it.
- [x] Keyboard: Space/K play/pause, M mute, Left/Right 5 s, Home/End, number keys to jump to 0 to 90%. *(Pure `actionForKey()` mapping, 6 unit tests; applied via `useVideoState`.)*
- [x] Auto-hide controls after 3 s of inactivity; show on tap or mouse move.
- **Done when:** scrubbing a 10-minute film feels immediate on desktop and phone, and every control works with the keyboard. ✅ Verified in a real browser (local Supabase stack): play/pause, mute/unmute, all keyboard shortcuts (K, M, →, Home, digit keys), and dragging the scrub bar to 75% landed on `currentTime` within 0.1% of the expected value — all against the real 522 s film, confirmed immediate. "Phone" (real touch device) still needs manual verification (AGENTS.md rule 7).
- **Found and fixed a real race condition** while testing: `prime()`'s `pause()` was chained onto the `play()` promise resolving, which could land *after* a closely-following `start()` call and silently re-pause a video that had just begun playing for real — reduced-motion (prime→start gap collapses to ~400ms) made this a live risk, not just a timing fluke. Fixed by making `pause()` run synchronously in the same tick as `play()`.

### T10. First-watch gate (FR-2.2, FR-2.5)
- [ ] `src/features/film/lib/watched-ranges.ts`: merge intervals; add a range on `timeupdate` only while playing, at a rate of 2 or less, and when the jump from the previous time is under 1.5 s (so seeks add nothing). Export `percentWatched(ranges, duration)`.
- [ ] Gate store: locked until 95% of the duration is watched or the film ends with 95% watched. Persist per film `version` in `localStorage` (`alllife:film:<version>:unlocked`).
- [ ] While locked: hide the close/exit control, disable board pan and page scroll, show a quiet "Watch to continue" progress hint. Scrubbing remains allowed.
- [ ] After unlock: **Replay** and **Continue**. Continue releases the full-screen layer and shows the Gallery region with the film as a node (the collage area is empty until Phase 2).
- [ ] Unit tests: overlapping ranges, seeking over gaps, playback-rate abuse, persistence, version bump re-lock.
- **Done when:** a user cannot skip to the end and unlock, and a returning user is not re-locked.

### T11. Full-screen layer and orientation (FR-2.4)
- [ ] A full-viewport layer (`position: fixed; inset: 0; height: 100dvh`) hosts the video. Use the Fullscreen API where available on desktop and Android; on iPhone use the layer only (no native player).
- [ ] Rotation changes layout without re-mounting the video or losing `currentTime` or the play state. Respect safe-area insets.
- **Done when:** rotating an iPhone mid-film keeps playback position and controls usable in both orientations.

### T12. Gallery route and region
- [ ] `/gallery` route focused on the `gallery` viewpoint; the film layer first. Back from `/gallery` returns to `/` without bypassing the gate on return.
- [ ] Board has the Gallery region with the film node; an unobtrusive placeholder node for the future collage, behind a dev flag.
- **Done when:** the whole path `/` to film to unlocked Gallery works end to end on the preview deployment.

### T13. Quality pass
- [ ] Playwright specs: entry sequence runs and lands on `/gallery`; Skip works; reduced-motion path; gate locks and unlocks (use the 20 s test film); orientation change keeps position (mobile-safari project); direct visit shows play button; axe has no serious or critical violations on `/` and `/gallery`.
- [ ] Measure against budgets in `docs/04-design-and-motion.md`; record numbers.
- [ ] Manual checks on a real iPhone and a mid-range Android phone (script in the hand-over).
- [ ] Frame-by-frame review of the light flood for photosensitivity (no flashing above 3 Hz).

### T14. Preview deployment and hand-over
- [ ] Vercel preview with env vars set; staging Supabase connected.
- [ ] Run `/finish-phase 1` and produce the demo script for the owner.

## Acceptance criteria

| # | Criterion | Maps to |
|---|---|---|
| A1 | Click to enter starts a spin-up to about 5 to 7 times speed, rays emerge gradually, the screen fills with light, the seal resolves into its finer luminous form and the light fades into the Gallery, in about 7 seconds with no loading gap on a mid-range phone. | FR-1.1 to FR-1.5, FR-1.7 |
| A2 | A skip control exists; reduced-motion users get a short cross-fade; nothing flashes above 3 Hz. | FR-1.6 |
| A3 | The film plays full screen on arrival through the primed element, or through a defined fallback; there is never a black screen. | FR-2.1 |
| A4 | Exit and scroll stay locked until 95% of distinct seconds are watched; a refresh does not re-lock unless the film version changes. | FR-2.2 |
| A5 | Play/pause, volume or mute, and fast scrubbing with thumbnails work by touch, mouse and keyboard. | FR-2.3 |
| A6 | Rotating an iPhone keeps position and state; landscape layout is usable. | FR-2.4 |
| A7 | After the first watch, Replay and Continue appear; Continue reveals the Gallery region. | FR-2.5 |
| A8 | The film streams with HLS from Supabase Storage with adaptive quality and recovers from a network drop. | FR-2.6 |
| A9 | RLS tests prove anonymous users can read only published film data and cannot write. | AGENTS rule 5 |
| A10 | CI is green; budgets hold; axe shows no serious or critical issues; real-device notes are recorded. | Definition of Done |

## Risks to watch

- iOS autoplay rules change by version: always test on a real device and keep the fallback chain.
- If the seal is only a video or image, the "still 3D luminous form" may need a new asset or a three.js model. Flag the cost (about 24 to 40 extra creative-developer hours) to the owner instead of absorbing it silently.
- Large film files: check Storage egress after testing and warn the owner if usage is trending high.

## Starter prompt for Claude Code

```
/start-phase 1
```

Then, after approving the plan: "Begin with T1 and T2 only. Stop after T2 and show me the audit and the green CI run before moving on."
