# Phase 1 real-device checklist

Everything below needs an actual iPhone and an actual mid-range Android phone —
none of it can be verified from this sandbox (no GUI, no device, and
Playwright's Linux WebKit build can't decode this project's HLS film at all;
see `docs/decisions.md` D-27). Run through this on the T14 preview deploy
before calling Phase 1 done, and record the result (pass / fail / note)
against each line.

Reference devices (per `docs/04-design-and-motion.md` §7): an iPhone 12 or
newer running Safari, and a 2021-class mid-range Android phone running Chrome.

## Entry sequence
- [ ] Tap "Click to enter" with sound on — does the sequence feel like ~7s,
      not janky or dropping frames?
- [ ] Skip control actually skips immediately, no stutter.
- [ ] With the OS's "Reduce Motion" setting on, the sequence collapses to the
      short cross-fade (no rays, no speed ramp).
- [ ] No visible flash/strobe during the light-flood ramp (this is also
      covered by a unit test on the underlying curves — D-notes in
      `src/features/entry/photosensitivity.test.ts` — but a real screen is
      the final check for anything the model doesn't capture, e.g. OLED
      brightness response).

## Autoplay and the first-watch gate
- [ ] iPhone Safari: does the film actually autoplay (muted is fine) right
      after the entry sequence, with no black screen at any point? If it
      falls back to "Tap for sound" or the big play button, confirm that
      fallback actually works with one tap.
- [ ] Android Chrome: same check — autoplay, or a working fallback.
- [ ] A **direct** visit to `/gallery` (new tab, no "Click to enter" gesture)
      shows the poster and a play button, not a black screen.
- [ ] Watch the film through to the end honestly — Replay/Continue appear,
      and the "Watch to continue" hint disappears.
- [ ] Try to cheat: seek/scrub straight to the end. Confirm it does **not**
      unlock (no Replay/Continue, no `alllife:film:*` key in localStorage).
- [ ] Reload the page after a genuine unlock — confirm you're not re-locked.

## Controls
- [ ] Play/pause, mute, and the volume slider all respond to touch.
- [ ] **iPhone specifically**: confirm the volume slider is hidden (iOS
      doesn't allow scripted volume control) rather than present-but-broken.
- [ ] Scrub bar: drag to seek, confirm the sprite thumbnail preview shows
      while dragging and the video actually jumps there on release.
- [ ] Controls auto-hide after a few seconds of inactivity, and reappear on
      tap/touch.

## Orientation and full-screen
- [ ] Rotate the phone mid-playback (portrait → landscape → portrait). The
      film should keep playing from the same position, no re-buffering from
      zero, no visible remount/flash.
- [ ] Android: does the film actually go full-screen (Fullscreen API)? Confirm
      exiting fullscreen (back gesture/button) doesn't break playback.
- [ ] iPhone: confirm the full-viewport layer looks right even with the
      Dynamic Island / home indicator safe areas — nothing obscured, no
      dead-zone at the very bottom/top.

## Performance (record actual numbers, not just pass/fail)
- [ ] Time from tapping "Enter" to the film visibly playing on `/gallery`
      (stopwatch is fine).
- [ ] Any visible stutter/frame drop during the entry sequence.
- [ ] Film start time to first visible frame on the device's real network
      (budget: under 3s at 5 Mbps — note the actual connection type/speed
      when you measure this, e.g. "4G, ~15 Mbps down").
- [ ] If you can run Lighthouse against the real preview URL from the
      device (or via remote debugging), record performance/accessibility
      scores — the sandbox numbers in `docs/decisions.md` D-29 are
      simulated-throttling-only and not a substitute.

## Known, already-flagged items (don't re-report these as new bugs)
- Landing-page LCP is slower than budget in Lighthouse (D-29) — traced to the
  pre-existing `all_life_1.webm` asset being loaded before `all_life_1.mp4`;
  this is a flagged owner follow-up, not a Phase 1 regression.
- The "finer luminous form" for the seal is CSS brightness/blur/blend on the
  existing video, not a new asset (see `docs/landing-audit.md` and D-notes on
  the seal) — expected to look like a glow/bloom effect, not a different seal.
