import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { FloodOverlay } from "@/features/entry/FloodOverlay";
import { preloadFilmAssets } from "@/features/entry/preload";
import { useEntryOrchestrator } from "@/features/entry/useEntryOrchestrator";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";

// Comfortably longer than the transition clip's own ~7.77s runtime, in case
// its `ended` event never fires (autoplay quirks, a slow first decode).
const TRANSITION_SAFETY_TIMEOUT_MS = 9000;

const LandingVideo = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const hasStartedRef = useRef(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDone = useCallback(() => {
    const { start, reveal } = useFilmControllerStore.getState();
    void start();
    reveal();
    navigate("/gallery");
  }, [navigate]);

  const entry = useEntryOrchestrator(handleDone);

  // Maximum autoplay reliability (iOS, Android, desktop) for the idle loop.
  useEffect(() => {
    const video = idleVideoRef.current;
    if (!video) return;
    const play = () => video.play().catch(() => {});
    play();
    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);
    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
    };
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current !== null) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearSafetyTimeout, [clearSafetyTimeout]);

  const handleTransitionEnded = useCallback(() => {
    clearSafetyTimeout();
    entry.finish();
  }, [clearSafetyTimeout, entry]);

  const handleEnter = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    entry.start();
    void preloadFilmAssets(queryClient);
    // Primes the gallery film's <video> element synchronously within this
    // click gesture, so the later programmatic play() in handleDone still
    // counts as gesture-unlocked even though the transition takes several
    // seconds.
    useFilmControllerStore.getState().prime();

    if (!entry.reducedMotion) {
      const transitionVideo = transitionVideoRef.current;
      if (transitionVideo) {
        transitionVideo.currentTime = 0;
        void transitionVideo.play().catch(() => {});
        safetyTimeoutRef.current = setTimeout(handleTransitionEnded, TRANSITION_SAFETY_TIMEOUT_MS);
      }
    }
  }, [entry, queryClient, handleTransitionEnded]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleEnter();
      }
    },
    [handleEnter]
  );

  const handleSkip = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      clearSafetyTimeout();
      transitionVideoRef.current?.pause();
      entry.skip();
    },
    [entry, clearSafetyTimeout]
  );

  const isStarted = entry.state.phase !== "idle";
  const isTransitioning = !entry.reducedMotion && entry.state.phase === "transitioning";

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-black cursor-pointer"
      onClick={handleEnter}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Enter ALL LIFE"
    >
      {/* Perfect full-screen video – never cropped, always centered */}
      <video
        ref={idleVideoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/videos/all_life_poster.jpg"
        className="fixed inset-0 w-full h-full object-contain object-center bg-black"
        style={{
          maxWidth: "100vw",
          maxHeight: "100vh",
          width: "auto",
          height: "auto",
          minWidth: "100vw",
          minHeight: "100vh",
          visibility: isTransitioning ? "hidden" : "visible",
        }}
        aria-hidden="true"
      >
        <source src="/videos/all_life_1.webm" type="video/webm" />
        <source src="/videos/all_life_1.mp4" type="video/mp4" />
      </video>

      {/*
        The owner's own click-to-enter footage (docs/decisions.md) — the
        seal bursting into light, played once start to finish, replacing
        the old CSS-faked rays/flood/luminous-filter sequence entirely.
        Muted, no loop, mounted from the start (not created on click) so
        preload="auto" has time to buffer before it's ever shown. Its own
        `ended` event (or the safety timeout above) hands off to the film
        via entry.finish() — there's no fixed millisecond timer driving
        this any more.
      */}
      <video
        ref={transitionVideoRef}
        muted
        playsInline
        preload="auto"
        onEnded={handleTransitionEnded}
        className="fixed inset-0 w-full h-full object-contain object-center bg-black"
        style={{ visibility: isTransitioning ? "visible" : "hidden" }}
        aria-hidden="true"
      >
        <source src="/videos/all_life_transition.webm" type="video/webm" />
        <source src="/videos/all_life_transition.mp4" type="video/mp4" />
      </video>

      {/* Very subtle overlay for depth (optional – remove if you want pure video) */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      <FloodOverlay opacity={entry.state.floodOpacity} />

      {/* Invisible clickable overlay + subtle hint on mobile */}
      <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
        {/* <p className="text-white/50 text-sm tracking-widest font-light animate-pulse md:hidden">
          TAP TO ENTER
        </p> */}
      </div>

      {isStarted && entry.state.phase !== "done" && (
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-6 right-6 z-40 text-white/70 hover:text-white text-sm tracking-widest font-light uppercase px-4 py-2 pointer-events-auto"
          aria-label="Skip entry animation"
        >
          Skip
        </button>
      )}
    </div>
  );
};

export default LandingVideo;
