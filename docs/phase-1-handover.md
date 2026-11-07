# Phase 1 hand-over: landing page to film play

**Status:** done, with the real-device checks below still outstanding (they need an actual iPhone and Android phone — AGENTS.md rule 7; nothing in this sandbox can substitute for them).

## What was built

- **Doc kit fixed**: the build-kit docs were committed with scrambled filenames/layout; reconstructed into `docs/`, `phases/`, `.claude/commands/` before any phase work started.
- **Tooling and CI**: Vitest+jsdom+Testing Library, Playwright (4 projects), axe-core, strict TypeScript (scoped via `tsconfig.strict.json`), GitHub Actions CI. CI was actually red on every run since T6 until this task — see "What was fixed along the way" below.
- **Supabase foundation**: migration `0001_core_and_film` (media + gallery_film tables, RLS), pgTAP tests (15 assertions), typed client, applied to the real staging project (`xuengnzfnywlbvcjmwie`).
- **Film pipeline**: `scripts/encode-hls.sh` (adaptive HLS ladder + poster + scrub sprite), `scripts/upload-film.ts`, `scripts/generate-test-film.sh`. The **real film** is live on staging (owner-supplied, not a placeholder).
- **Canvas shell**: minimal camera/board/region/viewpoint engine — just enough for Phase 2 to build gestures on top of without changing this API.
- **Entry sequence**: the existing seal video now drives a ~7.3s spin-up → rays → light-flood → reveal sequence, Skip control, full reduced-motion path, no asset changes to the existing landing page beyond wiring its one commented-out click handler.
- **Film player**: HLS via `hls.js`/native Safari HLS, a single persistent `<video>` element (survives route changes), autoplay priming with a 3-tier fallback (unmuted → muted → play button), full controls (play/pause/mute/volume/scrub with sprite thumbnails), keyboard shortcuts, fullscreen + orientation support.
- **First-watch gate**: anti-cheat watched-range tracking (seeking/scrubbing-ahead adds nothing), 95% unlock threshold, persisted per film version, Replay/Continue on completion.
- **Gallery route**: `/gallery` is real (no more 404), film-first, with a dev-only collage placeholder for Phase 2.
- **Quality pass**: 110 unit tests, 4 new Playwright specs (entry sequence, gate, accessibility, orientation) all passing in CI, a photosensitivity regression test, measured performance budgets.

## What was fixed along the way (not originally scoped, found during verification)

These are real bugs/gaps this session caught by actually verifying against real browsers and the real CI — not things anyone asked for, and each is documented in `docs/decisions.md`:

1. **CI was red on every single run since T6** (D-30) — never caught because it was only ever checked locally. Root cause: Node 20 (what CI used) can't run this project's test suite at all (`jsdom`'s dependency tree needs Node 22+). Fixed, plus three follow-up gaps (`ffmpeg` missing, a script not creating its output directory, Playwright only running 2 of 4 projects) that only a real fresh-checkout CI run surfaces. [Run #12](https://github.com/Hwndy/craft-commerce-co/actions/runs/42328047414) is the first genuinely green run of this phase.
2. **A race condition** (D-24/T9) where priming a video and starting it in quick succession (as reduced-motion does) could silently re-pause a video that had just started playing for real.
3. **A UI-blocking bug** (D-28/T13) where a late playback error after a genuine watch-through could render on top of, and silently block clicks on, the Replay/Continue screen.
4. **An accessibility violation** (T13) from dead fallback text inside the landing seal's `aria-hidden` video.
5. **A Vercel env-var gap** — production crashed on load because env vars were set for Preview only.

## What was deferred, and why

- **Real film pipeline validation on real devices** (desktop Safari, iPhone Safari playback) — AGENTS.md rule 7; this sandbox has no GUI/device.
- **Playwright's WebKit-family video assertions** (D-27) — this sandbox's (and GitHub Actions') Linux WebKit build has no H.264/AAC decoder at all, confirmed directly (`MediaSource.isTypeSupported` returns `false`, no native HLS either). Real Safari is unaffected; these assertions are skipped with the reason stated inline, not silently passed.
- **The landing page's LCP/Lighthouse-performance miss** (D-29) — traced to the pre-existing `all_life_1.webm` asset (4.7MB, loaded before the smaller `.mp4`). This predates Phase 1 and AGENTS.md rule 2 says not to change the existing landing page outside Phase 1's named integration points, so it's flagged for the owner rather than fixed unasked.
- **The "finer luminous form"** is CSS brightness/blur/blend on the existing seal video, not a new 3D asset — no luminous asset exists to use (confirmed in the T1 audit), and AGENTS.md says not to guess about assets.

## Manual checks the owner must do on a real iPhone and a mid-range Android phone

Full checklist: `docs/real-device-checklist.md`. The short version — autoplay and the fallback chain, the first-watch gate (including trying to cheat it), scrubbing by touch, rotating mid-playback, and whether the entry sequence has a loading gap on a real connection.

## Demo script (5 steps)

1. Open `https://www.alllifeworks.com/` on a phone or desktop browser. You'll see the spinning seal and "Click to enter."
2. Tap/click it. Watch the seal speed up, rays emerge, the screen fill with light, and fade into the Gallery — about 7 seconds, with the film already playing. (Try the Skip button on a second visit to see it jump straight there.)
3. Use the controls: tap to show/hide them, scrub the timeline (you'll see thumbnail previews while dragging), toggle mute. On desktop, try the keyboard — Space to pause, arrow keys to seek, M to mute.
4. Watch the film through to the end (or open dev tools and skip ahead — you'll notice it refuses to unlock early, exactly as designed). Replay and Continue appear once you've genuinely finished it.
5. Rotate your phone mid-playback. The film keeps playing from the same position — it doesn't restart or flash.

## What's next

Phase 2 (`phases/PHASE-2-canvas-and-collage.md`): full pan/zoom gestures, the circular photo collage, guided mode, minimap. It needs the owner's photo-shoot images and board-layout confirmation before it can really start. Not started in this session, per the brief's "do not build ahead" rule.
