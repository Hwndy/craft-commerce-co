import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { FloodOverlay } from "@/features/entry/FloodOverlay";
import { RaysCanvas } from "@/features/entry/RaysCanvas";
import { VideoSealController } from "@/features/entry/SealController";
import { preloadFilmAssets } from "@/features/entry/preload";
import { useEntryOrchestrator } from "@/features/entry/useEntryOrchestrator";
import type { SealController } from "@/features/entry/types";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";

const LandingVideo = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sealControllerRef = useRef<SealController | null>(null);
  const hasStartedRef = useRef(false);

  const handleDone = useCallback(() => {
    const { start, reveal } = useFilmControllerStore.getState();
    void start();
    reveal();
    navigate("/gallery");
  }, [navigate]);

  const entry = useEntryOrchestrator(handleDone);

  // Maximum autoplay reliability (iOS, Android, desktop)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    sealControllerRef.current = new VideoSealController(video);

    const play = () => video.play().catch(() => {});
    play();
    video.addEventListener("loadeddata", play);
    video.addEventListener("canplay", play);

    return () => {
      video.removeEventListener("loadeddata", play);
      video.removeEventListener("canplay", play);
      sealControllerRef.current?.destroy();
      sealControllerRef.current = null;
    };
  }, []);

  // Apply the orchestrator's state to the seal every time it changes.
  useEffect(() => {
    const seal = sealControllerRef.current;
    if (!seal) return;
    seal.setSpeed(entry.state.speedMultiplier);
    seal.setLuminous(entry.state.luminousAmount);
  }, [entry.state.speedMultiplier, entry.state.luminousAmount]);

  const handleEnter = useCallback(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    entry.start();
    void preloadFilmAssets(queryClient);
    // Primes the gallery film's <video> element synchronously within this
    // click gesture, so the later programmatic play() in handleDone still
    // counts as gesture-unlocked even though the entry sequence takes
    // several seconds.
    useFilmControllerStore.getState().prime();
  }, [entry, queryClient]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleEnter();
      }
    },
    [handleEnter]
  );

  const isStarted = entry.state.phase !== "idle";

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
        ref={videoRef}
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
        }}
        aria-hidden="true"
      >
        <source src="/videos/all_life_1.webm" type="video/webm" />
        <source src="/videos/all_life_1.mp4" type="video/mp4" />
        Your browser does not support video.
      </video>

      {/* Very subtle overlay for depth (optional – remove if you want pure video) */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {!entry.reducedMotion && <RaysCanvas intensity={entry.state.rayIntensity} />}
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
          onClick={(event) => {
            event.stopPropagation();
            entry.skip();
          }}
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
