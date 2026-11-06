# Decision log

Defaults are used unless the owner overrides them. When you take a new decision, add an entry at the bottom using the template.

## Defaults for open questions

| ID | Question | Default |
|---|---|---|
| D-01 | Film behaviour after the reveal (landing notes say "waits for play", page 2 notes say "starts immediately") | Start automatically using the element primed in the "Click to enter" gesture; fall back to muted with an unmute prompt, then to a large play button. Controlled by `VITE_FILM_AUTOSTART`. |
| D-02 | Collage layout | Circular ("Idea 2"), phyllotaxis-style dense circle. "Idea 1" diagonal strips kept as an alternate layout value. |
| D-03 | Price currency | GBP only (the board shows GBP 40). Format with `Intl.NumberFormat('en-GB', ...)`. |
| D-04 | How the seal is built | Unknown until the Phase 1 audit. Control it through a `SealController` interface so the entry sequence does not depend on the answer. |
| D-05 | Film size and length | Assume up to 10 minutes and a 1.5 GB source. |
| D-06 | Turntable videos | Short MP4 loops (5 to 10 s, under 100 MB), poster required. |
| D-07 | First-watch gate scope | Once per device per film version, stored in `localStorage`; bumping `gallery_film.version` re-locks it. |
| D-08 | Online payments | Not in v1. Purchase by email. |
| D-09 | Replacing the film | Developer-assisted with `scripts/encode-hls.sh` and `scripts/upload-film.ts` in v1. |
| D-10 | Enquiry email address and provider | Owner supplies; Resend sends from the owner's domain once SPF/DKIM are set. |
| D-11 | Brand copy | Owner supplies; use clearly marked placeholders in development. |
| D-12 | First-visit mode | Guided mode first, Explore available at all times, choice remembered. |
| D-13 | Layout editing | Automatic layout plus numeric overrides in admin; no drag-and-drop editor in v1. |
| D-14 | Board centre | The mind map arrangement from the concept board: ALL LIFE in the middle, regions around it. |
| D-15 | Photo renditions | Created before upload (script in Phase 2, in-browser in Phase 4); no paid image transformations. |
| D-16 | Package manager | npm. |
| D-17 | Animation library | **framer-motion** (chosen in Phase 1 T6 — see the dated entry below). |
| D-18 | Prerender mechanism | Chosen in Phase 5. |

## Decisions taken

### D-04: How the seal is built (2026-11-06)
Context: Phase 1 T1 audit (`docs/landing-audit.md`) needed to know what `SealController` has to wrap.
Decision: The seal is a pre-rendered video loop (`public/videos/all_life_1.{mp4,webm}`), not CSS, an image sequence, canvas or three.js. `SealController`'s video implementation controls it via `playbackRate` and source/overlay swaps only; no shader or frame-stepping API is available. No separate "finer luminous form" asset exists, so T6 builds that state as a CSS cross-fade/blur/`mix-blend-mode: screen` treatment unless the owner supplies a dedicated asset.
Alternatives considered: none — this is a factual finding from inspecting `LandingVideo.tsx`, not a choice.
Consequences: If `playbackRate` ramping on the looping render looks stepped rather than smooth, that needs a visual check during T6 and may require a different treatment (e.g. a slow-motion re-render supplied by the owner) — flagged, not yet resolved.

### D-19: TypeScript strict mode scoping (2026-11-06)
Context: Phase 1 T2 — the existing Lovable-generated code (`src/components/ui/*`, `Home.tsx` sections) was written with `strict: false`. Flipping `strict: true` globally surfaced the kind of widespread, unrelated type errors across generated files that the brief says to avoid absorbing in one sitting.
Decision: `tsconfig.app.json`/`tsconfig.node.json` keep their existing relaxed settings for the pre-existing app. A new `tsconfig.strict.json` (extends `tsconfig.app.json`, `strict: true` plus the related flags, scoped to `src/canvas`, `src/features`, `src/lib`) is added, and `npm run typecheck` runs all three project files. All new ALL LIFE code under those three directories is strict from day one; generated/legacy code is untouched.
Alternatives considered: global `strict: true` with inline `// @ts-expect-error` suppressions across generated files — rejected as noisy and not worth the time for code that's largely superseded by Phase 2–3 features.
Consequences: when `src/app/` (routes/providers) is introduced later, add it to `tsconfig.strict.json`'s `include` too.

### D-20: Pre-existing lint errors fixed in T2 (2026-11-06)
Context: `npm run lint` didn't exist as a CI gate before T2. Running it for the first time surfaced 3 pre-existing errors in generated code (two empty `interface X extends Y {}` declarations in `command.tsx`/`textarea.tsx`, and a `require()`-style import in `tailwind.config.ts`), which would fail "CI is green" otherwise.
Decision: fixed all three minimally (interface → type alias; `require` → ESM import) with no behaviour change, so CI can be green from T2 onward. Pre-existing `react-refresh/only-export-components` warnings in shadcn files are left as warnings (non-blocking, out of scope).
Alternatives considered: exclude these files from lint — rejected, hides real issues from future phases instead of fixing them.
Consequences: none; purely a lint/type-level change.

### D-21: Remote migrations applied via the Management API, not `supabase db push` (2026-11-06)
Context: Phase 1 T3 — `npx supabase db push --remote` needs a direct Postgres connection to `aws-0-eu-west-2.pooler.supabase.com:5432`. From this cloud dev session that connection is refused outright (`ECONNREFUSED`) — this sandbox's network only routes outbound HTTPS (443) through its proxy; raw Postgres (5432) isn't reachable at all, independent of credentials or password.
Decision: applied migration 0001_core_and_film to the staging project (`xuengnzfnywlbvcjmwie`) over HTTPS instead, via the Supabase Management API's `POST /v1/projects/{ref}/database/query` endpoint (same access-token credential, routes through the normal HTTPS proxy). Since that endpoint doesn't update the CLI's own bookkeeping, also bootstrapped `supabase_migrations.schema_migrations` (schema + the standard `version text primary key, statements text[], name text` shape the CLI itself creates) and inserted a `('0001', 'core_and_film', ...)` tracking row, so a later `supabase db push --remote` — from a machine that *can* reach the Postgres port — sees migration 0001 as already applied and doesn't try to replay it.
Verified directly via the same API: both tables exist with `relrowsecurity = true`, all 4 policies are present, both storage buckets (`site-media` public, `originals` private) exist, and the tracking row is there. (`supabase migration list --remote` itself can't run from here for the same network reason — not used as the verification method.)
Alternatives considered: asking to widen this environment's network policy to allow raw TCP to the pooler host — not pursued, since the environment's proxy is HTTPS-only by design and this would likely need a different kind of change than a host allowlist entry; the Management API route needed no environment changes at all.
Consequences: future Supabase migrations (0002 onward) in later phases hit the same limitation in this sandbox and should use the same Management-API-plus-tracking-row approach, or be applied from an environment/machine with direct Postgres egress. If anyone ever runs `supabase db push --remote` for this project from a machine with normal network access, it will correctly skip 0001 as already applied.

### D-22: Node's fetch needs NODE_USE_ENV_PROXY in this sandbox (2026-11-06)
Context: `scripts/upload-film.ts` (via `@supabase/supabase-js`, which uses Node's built-in `fetch`) silently bypassed the session's HTTPS proxy and its injected service-role credential — requests reached Supabase directly with a literal placeholder key, failing with "signature verification failed" rather than a proxy error. `curl` worked fine for the same host.
Decision: run Node scripts that need a proxy-injected credential with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) in this environment. Documented in `scripts/README.md`. Not relevant outside a Claude Code cloud session.
Consequences: none for the owner; purely a note for future sessions/scripts in this kind of environment.

### D-23: Real film used in place of a short test film for T4 (2026-11-06)
Context: the brief's T4 default is a generated 20–30 s placeholder test film. The owner supplied the real film directly (`KIT_PROJECT_FINAL_COMP.mp4` via WeTransfer, 341 MB, 1920×1080, H.264/AAC, 8:42) during this session.
Decision: encoded and uploaded the real film instead of a placeholder — `media` row `1590e888-765c-4fb8-93a2-b5b2203793fc`, `gallery_film` row `a6c65c4d-a2d6-4362-9d03-7ee0849bd477` (published, version 1) on the staging project. Verified `master.m3u8` and the variant playlists are publicly reachable from Storage and the film row is readable per RLS.
Consequences: a **separate short synthetic test film** (ffmpeg `testsrc2`, ~20–30 s, per `docs/05-testing-and-quality.md` §2) is still needed for T9/T10/T13 — testing a 95%-watched first-watch gate against an 8:42 film in CI isn't practical. Not generated yet; flagged for whichever task first needs fast Playwright gate tests. Not yet verified in an actual browser/device (desktop Safari, Chrome via hls.js, iPhone) — only that the playlists are structurally valid and reachable; real playback needs a manual check per AGENTS.md rule 7 before this phase is called done.

### D-17: Animation library — framer-motion (2026-11-06)
Context: T6 needs to pick one of `framer-motion`/`gsap` (AGENTS.md's approved-dependency list) before building the entry sequence's UI transitions (Click-to-enter fade, Skip control, the flood-to-reveal cross-fade) and, later, Phase 2's camera-adjacent UI chrome (minimap, overlays, toasts).
Decision: `framer-motion`. It's declarative and integrates directly with React state/props (matching the Zustand-driven architecture already in `src/canvas`), and is the conventional pairing for a shadcn/ui + Tailwind stack like this repo's.
Alternatives considered: `gsap` — its imperative timeline API is arguably a closer fit for the entry sequence's exact-timing choreography, but framer-motion covers the same linear/eased tweens for this phase's actual needs (opacity/transform fades) without a second animation paradigm alongside React state. The entry sequence's own precise timing (rays, flood, seal) is driven by `EntryOrchestrator`'s pure time→state function, not by whichever library plays the simple UI fades, so this choice doesn't block revisiting gsap later if a feature genuinely needs its timeline features.
Consequences: Phase 2 onward should default to framer-motion for new UI animation unless a specific feature needs gsap's timeline/stagger tools, in which case record that exception here.

### D-24: T6 forward notes — film priming, bundle size, poster frame (2026-11-06)
- **Film priming (T8 dependency):** `LandingVideo.tsx`'s click handler (`handleEnter`) has a comment marking where `FilmController.prime()` needs to be added once T8 builds it — the gallery film's autoplay-unlock must share this same click's user gesture, so it has to be called from inside this handler, not later when `/gallery` mounts. Not implemented yet since T8 doesn't exist; flagged so it isn't missed.
- **Bundle size:** gzip JS went from 113.93 KB to 188.69 KB in this step, mostly `@supabase/supabase-js` (via the new film-prefetch query) actually entering the bundle for the first time. Still well under the Phase 1 "Initial JS before lazy chunks: 250 KB" budget, but code-splitting (dynamic `import()` per feature) is explicitly Phase 5 T2's job — tracking this now so the trend doesn't surprise anyone later.
- **Poster frame:** `scripts/encode-hls.sh`'s 10%-duration poster (see T4) lands during the entry sequence's bright flood moment and reads as mostly white — fine as a background-video poster (rarely seen, since the video usually loads fast), but worth a different timestamp if it's ever used as a static thumbnail elsewhere.

## Owner questions that block work

List here with a date when asked and the answer when received.

| Date | Question | Answer |
|---|---|---|
| 2026-11-06 | What is the seal built with (3D model, video, image sequence, CSS) and where are the source files? | Answered by inspection, no owner input needed: a pre-rendered video loop at `public/videos/all_life_1.mp4`/`.webm` (see D-04). |
| | Which address is production: alllifeworks.com or the Vercel preview address? | |
| | Is the "finer luminous" seal form a supplied asset, or should it be created with light effects? | |

## Template

```
### D-NN: Title (date)
Context:
Decision:
Alternatives considered:
Consequences:
```
