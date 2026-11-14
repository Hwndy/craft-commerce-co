import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";

import { useCameraStore } from "@/canvas/store";
import { cameraForViewpoint, getViewpoint } from "@/canvas/viewpoints";
import { Button } from "@/components/ui/button";
import { siteMediaUrl } from "@/lib/storage";

import { FilmControls } from "./components/FilmControls";
import { useFilmControllerStore } from "./filmControllerStore";
import { useGateStore } from "./gateStore";
import { exitFullscreenIfActive, requestFullscreen } from "./lib/fullscreen";
import { attachHls, type FatalPlaybackError } from "./lib/hls";
import { useFilm } from "./lib/useFilm";

const hiddenLayerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: -1,
  opacity: 0,
  pointerEvents: "none",
};

const revealedLayerStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  height: "100dvh",
  zIndex: 50,
  background: "#000",
};

const centeredOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  color: "#fff",
  textAlign: "center",
  padding: 16,
};

/**
 * The single, persistent <video> element for the gallery film. Mounted
 * once at the app root (outside the router) so it is never recreated by a
 * route change: that's what makes T8's priming (play()+pause() inside the
 * "Click to enter" gesture) still count once the entry sequence reveals
 * it, and sets up T11's "rotation doesn't remount the video" requirement
 * for free. Invisible and inert until `isRevealed`.
 */
export function FilmStage() {
  const location = useLocation();
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const registerVideoElement = useFilmControllerStore((s) => s.registerVideoElement);
  const videoElement = useFilmControllerStore((s) => s.videoElement);
  const isRevealed = useFilmControllerStore((s) => s.isRevealed);
  const isAutomaticReveal = useFilmControllerStore((s) => s.isAutomaticReveal);
  const isPrimed = useFilmControllerStore((s) => s.isPrimed);
  const fallback = useFilmControllerStore((s) => s.fallback);
  const start = useFilmControllerStore((s) => s.start);

  const { data: film } = useFilm();
  const masterUrl = film?.media.hlsMaster ? siteMediaUrl(film.media.hlsMaster) : null;
  const posterUrl = film?.media.posterPath ? siteMediaUrl(film.media.posterPath) : undefined;
  const captionsUrl = film?.captionsPath ? siteMediaUrl(film.captionsPath) : null;
  const spriteUrl = film?.media.spritePath ? siteMediaUrl(film.media.spritePath) : null;
  const spriteMeta = film?.media.spriteMeta ?? null;

  const gateInitFor = useGateStore((s) => s.initFor);
  const gateSetDuration = useGateStore((s) => s.setDuration);
  const gateRecordTimeUpdate = useGateStore((s) => s.recordTimeUpdate);
  const isUnlocked = useGateStore((s) => s.isUnlocked);
  const [hasEnded, setHasEnded] = useState(false);

  useEffect(() => {
    registerVideoElement(videoRef.current);
    return () => registerVideoElement(null);
  }, [registerVideoElement]);

  useEffect(() => {
    if (film?.version != null) gateInitFor(film.version);
  }, [film?.version, gateInitFor]);

  // Locked until 95% watched (D-07: persisted per film version). Disables
  // page scroll while locked; there's no board pan or exit control to
  // disable yet (Phase 2 / T11), so this is the part of T10's lock that
  // applies today.
  const isLocked = isRevealed && film != null && !isUnlocked;
  useEffect(() => {
    if (!isLocked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLocked]);

  // D-50's live region needs its very first *render* to be empty, not just
  // its first render relative to isRevealed/isLocked's own history: both
  // FilmStage and Gallery are separately lazy()-loaded (App.tsx), so on a
  // direct /gallery visit (no landing-page preload to order them) Gallery's
  // reveal() can run — and isLocked can already be true — before FilmStage's
  // chunk has even resolved once. Deriving the text directly from
  // isRevealed/isLocked during render would then make FilmStage's actual
  // first render already-populated, the exact bug this was meant to fix,
  // just moved to a different trigger (found in review). Starting this at
  // "" and only ever writing the real value from an effect — which only
  // runs after the first commit — guarantees the live region's first
  // committed content is always empty, independent of load order.
  const [lockAnnouncement, setLockAnnouncement] = useState("");
  useEffect(() => {
    setLockAnnouncement(isLocked ? "Watch once to unlock the gallery" : "");
  }, [isLocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      gateRecordTimeUpdate(video.currentTime, video.playbackRate, !video.paused);
    };
    const onDurationChange = () => {
      if (Number.isFinite(video.duration)) gateSetDuration(video.duration);
    };
    const onEnded = () => {
      // One final flush in case the last fractional second missed a
      // timeupdate — still subject to the same anti-cheat rules.
      gateRecordTimeUpdate(video.currentTime, video.playbackRate, true);
      setHasEnded(true);
    };
    const onPlay = () => setHasEnded(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
    };
  }, [gateRecordTimeUpdate, gateSetDuration]);

  const [fatalError, setFatalError] = useState<FatalPlaybackError | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !masterUrl) return;

    setFatalError(null);
    const controller = attachHls(video, masterUrl, {
      onFatalError: (error) => setFatalError(error),
    });
    return () => controller.destroy();
  }, [masterUrl, retryToken]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  // Direct /gallery visits (isRevealed without having gone through the
  // entry sequence's prime()) still need a start attempt — it just won't
  // have gesture credit, so it reliably lands on the play-button fallback.
  useEffect(() => {
    if (isRevealed && masterUrl) {
      void start();
    }
  }, [isRevealed, masterUrl, start]);

  // Fullscreen API on desktop/Android; naturally a no-op on iPhone, where
  // document.fullscreenEnabled is false — the fixed/100dvh layer already
  // looks full-screen there without handing control to iOS's native video
  // player chrome (T11).
  //
  // Only requested when the film actually needs watching (isLocked at the
  // moment isRevealed turns true) — an already-unlocked visitor (a direct
  // deep link into Gallery.tsx's own Board/Shop/etc., which also calls
  // reveal() unconditionally so the lock can show if needed) has nothing
  // here worth taking over the whole browser window for. isLockedRef, not
  // isLocked itself, is read deliberately: this must decide once, at the
  // isRevealed transition, not re-fire fullscreen's entry check on every
  // later isLocked flip (watching through mid-playback shouldn't itself
  // trigger an exit before Replay/Continue — exit still only follows
  // isRevealed, i.e. Continue or leaving /gallery). Found while tracing a
  // real, reproducible e2e failure (ProductOverlay's Close/Copy-email
  // buttons silently swallowing every click): a deep-linked, already-
  // unlocked visit was still requesting fullscreen on `stageRef` — and
  // once an element is the Fullscreen API's actual top-layer element,
  // every click anywhere outside its own subtree (including a Dialog
  // portaled to body, with a *higher* CSS z-index) stops hit-testing
  // entirely, confirmed by reproducing the identical symptom in isolation
  // (elementFromPoint/click on an unrelated sibling button resolving to
  // the fullscreen element instead, every time, until exited).
  const isLockedRef = useRef(isLocked);
  // Written from an effect, not during render (React can replay or discard
  // a render, which must stay pure — CodeRabbit review, PR #2) — declared
  // before the reveal effect below so effect-declaration order guarantees
  // it's updated first whenever both fire in the same commit.
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);
  useEffect(() => {
    if (isRevealed) {
      if (isLockedRef.current && stageRef.current) void requestFullscreen(stageRef.current);
    } else {
      void exitFullscreenIfActive();
    }
  }, [isRevealed]);

  // T6 (found via a real, reproducible e2e failure — About/Contact's own
  // form fields unclickable after a *second*, already-unlocked navigation
  // straight into /gallery/contact): Gallery.tsx's own reveal() runs
  // unconditionally on every mount (T10/D-07, by design, so the lock can
  // show on a direct deep link) — but nothing ever dismissed the
  // resulting layer again once it turned out not to need watching.
  // Unlike the Fullscreen-API problem above (D-55), this is a plain CSS
  // stacking issue: `revealedLayerStyle` is a full-screen, fully-
  // interactive layer (z-index 50, no pointer-events override), which
  // previously went unnoticed because every other deep-linked board
  // content (Shop, the photo viewer) opens in a Dialog elevated well
  // above it — About/Contact are the first real board content with
  // nothing elevating it.
  //
  // Gated on `isAutomaticReveal`, not just `isRevealed`: an explicit,
  // visitor-requested reveal (the Gallery board card, Replay) must never
  // be silently cancelled just because the gate happens to already be
  // unlocked — a first attempt at this fix conflated the two and broke
  // re-watching (found in review, Greptile, PR #3).
  //
  // A genuinely reactive effect (not isRevealed-only, one-shot): `film`
  // is network-loaded and `undefined` while pending, so this waits (does
  // nothing) until it settles one way or the other, then re-evaluates for
  // real once it does (found in review, Greptile, PR #3, on a first
  // attempt at this fix). Deliberately reads `useGateStore.getState().
  // isUnlocked` live rather than the React-subscribed `isUnlocked` value,
  // and `isUnlocked` is deliberately *not* a dependency: within the same
  // commit where `film` first resolves, `gateInitFor`'s own effect above
  // (declared earlier, so it runs first) synchronously corrects the gate
  // store's *actual* value the instant it learns the film's version — but
  // React doesn't retroactively update an *already-rendered* closure's
  // `isUnlocked`, only the *next* one. A second attempt at this fix read
  // the stale, not-yet-corrected closure value at exactly that instant,
  // which reads as "locked" for one render even for an already-unlocked
  // returning visitor — and because that attempt also *latched* that
  // reading permanently (to protect the mid-watch-unlock case below), the
  // false reading stuck forever instead of self-correcting on the next
  // render (found the same way, a second real CI failure on the same
  // fix). Reading the store live sidesteps the staleness entirely; *not*
  // depending on `isUnlocked` is what naturally keeps this effect from
  // re-firing when a *genuinely* locked visitor later unlocks it by
  // actually watching through — nothing else in this effect's own
  // dependencies changes at that moment, so it simply doesn't re-run, and
  // the deliberate Replay/Continue screen is reached undisturbed.
  useEffect(() => {
    if (!isRevealed || !isAutomaticReveal) return;
    if (film === undefined) return; // still loading — re-runs once it resolves
    if (film === null || useGateStore.getState().isUnlocked) {
      // Also stop any playback the separate start() effect may already
      // have begun (it fires on every isRevealed, including an automatic
      // one that turns out not locked, since a genuinely locked visitor
      // needs it starting immediately) — hide() alone only changes
      // isRevealed, it was never responsible for pausing the video
      // (Continue never needed to: by the time it's clickable, the film
      // has already ended on its own) — found in review, Greptile, PR #3.
      videoRef.current?.pause();
      useFilmControllerStore.getState().hide();
    }
  }, [isRevealed, isAutomaticReveal, film]);

  return (
    <div
      ref={stageRef}
      data-testid="film-stage"
      style={isRevealed ? revealedLayerStyle : hiddenLayerStyle}
      className="font-body text-sm text-white"
    >
      {/* Mounted unconditionally and never a descendant of the aria-hidden
       * wrapper below — a screen reader has therefore already "seen" this
       * exact element before its text can ever change. Nesting it under
       * that wrapper (an earlier version of this fix did) doesn't actually
       * solve the timing problem: isRevealed and isLocked can both already
       * be true on the very first render a visitor's screen reader
       * processes, so the wrapper's own aria-hidden flips to false in the
       * same tick the text would appear — AT can still miss it. Its text
       * comes from `lockAnnouncement` state, not a direct isRevealed/
       * isLocked expression, for the same reason one level up: FilmStage
       * itself is lazy()-loaded (App.tsx), separately from Gallery, so on a
       * direct /gallery visit (no landing-page preload to order the two)
       * Gallery's reveal() can run before FilmStage's chunk has even
       * resolved once — making isLocked already true on FilmStage's actual
       * first render too. `lockAnnouncement` starts at "" unconditionally
       * and is only ever set from an effect (which can't run before the
       * first commit), so the live region's first committed content is
       * always empty regardless of chunk load order (found in review,
       * docs/decisions.md D-50). Kept inside `stageRef` itself (not a true
       * sibling of it) rather than hoisted further out: the Fullscreen API
       * stops rendering anything outside the fullscreen element's own
       * subtree, and `stageRef` is exactly what gets requestFullscreen()'d
       * below — a sibling further out would go silent during fullscreen,
       * exactly when the lock matters most. `sr-only` clips visually
       * without `display:none`/`visibility:hidden`, both of which (like
       * aria-hidden) would also pull it from the accessibility tree. The
       * watched-percent is deliberately left out of this content: it ticks
       * on every timeupdate, which would otherwise announce on every
       * percentage point instead of just the lock state. */}
      <div aria-live="polite" className="sr-only">
        {lockAnnouncement}
      </div>

      {/* Everything below is purely visual chrome + the video itself, so
       * it's fine for this whole subtree to drop out of the accessibility
       * tree while not revealed — unlike the live region above, nothing
       * here needs to exist pre-emptively. `position: absolute; inset: 0`
       * keeps this wrapper's box identical to `stageRef`'s own (its
       * nearest positioned ancestor), so every existing absolutely-
       * positioned child below still resolves exactly as it did when they
       * were direct children of `stageRef`. */}
      <div aria-hidden={!isRevealed} style={{ position: "absolute", inset: 0 }}>
        {isRevealed && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-sm font-bold uppercase tracking-wider">Gallery</span>
              <span className="text-xs text-white/60">/ Film</span>
            </div>
            {/* Purely decorative now that the sr-only live region above owns
             * the actual announcement — stays plain visible text (not
             * aria-live) so it isn't double-announced on every change.
             * data-testid, not getByText, is what e2e/gate.spec.ts scopes
             * to: once two elements can contain this exact string, a bare
             * text locator is ambiguous (the same class of issue already
             * fixed once in this PR for the photo-viewer filmstrip). */}
            <div
              data-testid="film-lock-pill"
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-background/70 px-4 py-2 text-xs font-medium backdrop-blur-sm"
              style={{ visibility: isLocked ? "visible" : "hidden" }}
            >
              <span aria-hidden="true">🔒</span>
              <span>{isLocked ? "Watch once to unlock the gallery" : ""}</span>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          playsInline
          poster={posterUrl}
          style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
          tabIndex={isRevealed ? 0 : -1}
          aria-label={film?.title}
        >
          {captionsUrl && (
            <track kind="captions" src={captionsUrl} srcLang="en" label="English" />
          )}
        </video>

        {isRevealed && isBuffering && fallback === "autoplay" && !fatalError && (
          <div style={{ ...centeredOverlayStyle, pointerEvents: "none" }}>
            <div className="buffering-ring" aria-hidden="true" />
          </div>
        )}

        {isRevealed && fallback === "muted" && (
          <div
            className="absolute left-1/2 z-10 -translate-x-1/2"
            style={{ bottom: "calc(24px + env(safe-area-inset-bottom))" }}
          >
            <Button
              type="button"
              variant="pill"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = false;
                void video.play();
              }}
            >
              <span aria-hidden="true">🔊</span> Tap for sound
            </Button>
          </div>
        )}

        {isRevealed && fallback === "play-button" && !fatalError && (
          <div style={centeredOverlayStyle}>
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = isPrimed ? video.muted : false;
                video.play().catch(() => {
                  video.muted = true;
                  void video.play();
                });
              }}
              aria-label="Play the film"
              className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-white bg-black/40 text-3xl text-white"
            >
              ▶
            </button>
          </div>
        )}

        {isRevealed && !fatalError && (fallback === "autoplay" || fallback === "muted") && (
          <FilmControls
            video={videoElement}
            spriteUrl={spriteUrl}
            spriteMeta={spriteMeta}
            captionsAvailable={captionsUrl != null}
          />
        )}

        {isRevealed && hasEnded && isUnlocked && (
          <div style={{ ...centeredOverlayStyle, background: "rgba(0,0,0,0.85)" }}>
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-background/80 p-6 backdrop-blur-sm">
              <span className="font-body text-xs font-medium uppercase tracking-wider text-white/60">
                After the first full watch
              </span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="pill-outline"
                  onClick={() => {
                    const video = videoRef.current;
                    if (!video) return;
                    video.currentTime = 0;
                    setHasEnded(false);
                    void video.play();
                  }}
                >
                  Replay
                </Button>
                <Button
                  type="button"
                  variant="pill"
                  onClick={() => {
                    // T10: once unlocked, Continue hands the visitor straight to
                    // the collage rather than leaving them wherever Explore-mode
                    // panning happened to be — flyTo (not setCamera) so this reads
                    // as a deliberate hand-off, same as Guided mode's Next/
                    // Previous, and respects prefers-reduced-motion the same way.
                    // T6: unless the visitor arrived via a direct /about or
                    // /contact deep link — reading the *current* URL here
                    // (not a value captured at mount) matches how this button
                    // already reads prefers-reduced-motion fresh on each
                    // click; the destination can only be either of these two
                    // literal paths (App.tsx's redirects land on exactly one
                    // /gallery/<key> URL each) or plain /gallery itself,
                    // never a changing value otherwise — found in review
                    // (Greptile/CodeRabbit, PR #3): this handoff was
                    // previously unconditional, so a first-time visitor's
                    // requested About/Contact destination was silently lost
                    // the moment they clicked Continue. cameraForViewpoint
                    // (viewpoints.ts) centres the landing camera for exactly
                    // these two keys — a no-op for "collage" itself, so its
                    // own already-tested landing position is unchanged.
                    //
                    // Gated on isAutomaticReveal too (found in review,
                    // CodeRabbit, PR #3): the board never updates the URL as
                    // the camera pans, so a visitor who landed on
                    // /gallery/contact, panned away and later triggered an
                    // *explicit* rewatch (Gallery's own "watch" card) would
                    // still read a stale /gallery/contact here and get flown
                    // straight back to Contact instead of this button's
                    // normal explicit-rewatch-to-collage handoff.
                    const destinationKey = !isAutomaticReveal
                      ? "collage"
                      : location.pathname === "/gallery/about"
                        ? "about"
                        : location.pathname === "/gallery/contact"
                          ? "contact"
                          : "collage";
                    const destination = getViewpoint(destinationKey);
                    const { viewport, flyTo } = useCameraStore.getState();
                    const reducedMotion =
                      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
                    void flyTo(cameraForViewpoint(destination, viewport), { reducedMotion });
                    useFilmControllerStore.getState().hide();
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/*
         * Excludes hasEnded && isUnlocked: once a viewer has genuinely
         * watched through and unlocked the gate, a fatal hls.js error from
         * this point on (e.g. a late buffering/network blip) must not trap
         * them behind an error overlay that sits on top of — and blocks
         * clicks on — the Replay/Continue screen below. Replaying re-attaches
         * HLS from scratch (via retryToken) and can surface a fresh error
         * then if it recurs.
         */}
        {isRevealed && fatalError != null && !(hasEnded && isUnlocked) && (
          <div style={{ ...centeredOverlayStyle, background: "rgba(0,0,0,0.85)" }} role="alert">
            <p>Playback failed.</p>
            {/*
             * Small, low-contrast diagnostic detail — not alarming copy for a
             * regular visitor, but real signal if this is ever screenshotted
             * and reported (which is all we had for D-38/D-39's incidents —
             * the full detail is also always console.error'd, see hls.ts).
             */}
            {fatalError.detail && (
              <p style={{ fontSize: 11, opacity: 0.5, maxWidth: 320 }}>
                {fatalError.reason} · {fatalError.detail}
              </p>
            )}
            <Button type="button" variant="pill-outline" onClick={() => setRetryToken((t) => t + 1)}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
