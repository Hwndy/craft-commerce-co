import { useEffect, useRef, useState, type CSSProperties } from "react";

import { siteMediaUrl } from "@/lib/storage";

import { FilmControls } from "./components/FilmControls";
import { useFilmControllerStore } from "./filmControllerStore";
import { useGateStore } from "./gateStore";
import { attachHls } from "./lib/hls";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const registerVideoElement = useFilmControllerStore((s) => s.registerVideoElement);
  const videoElement = useFilmControllerStore((s) => s.videoElement);
  const isRevealed = useFilmControllerStore((s) => s.isRevealed);
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
  const gatePercent = useGateStore((s) => s.percent);
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

  const [fatalError, setFatalError] = useState<unknown>(null);
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

  return (
    <div style={isRevealed ? revealedLayerStyle : hiddenLayerStyle} aria-hidden={!isRevealed}>
      <video
        ref={videoRef}
        playsInline
        poster={posterUrl}
        style={{ width: "100%", height: "100%", display: "block" }}
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
        <button
          type="button"
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            video.muted = false;
            void video.play();
          }}
          style={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            color: "#fff",
            background: "rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 999,
            padding: "8px 20px",
          }}
        >
          Tap for sound
        </button>
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
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "2px solid #fff",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              fontSize: 28,
            }}
          >
            ▶
          </button>
        </div>
      )}

      {isRevealed && !fatalError && (fallback === "autoplay" || fallback === "muted") && (
        <FilmControls video={videoElement} spriteUrl={spriteUrl} spriteMeta={spriteMeta} />
      )}

      {isLocked && !hasEnded && (fallback === "autoplay" || fallback === "muted") && (
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 12,
            letterSpacing: 1,
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          Watch to continue · {Math.round(gatePercent * 100)}%
        </div>
      )}

      {isRevealed && hasEnded && isUnlocked && (
        <div style={{ ...centeredOverlayStyle, background: "rgba(0,0,0,0.85)" }}>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.currentTime = 0;
              setHasEnded(false);
              void video.play();
            }}
            style={{
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.5)",
              borderRadius: 999,
              padding: "10px 24px",
            }}
          >
            Replay
          </button>
          <button
            type="button"
            onClick={() => useFilmControllerStore.getState().hide()}
            style={{
              color: "#000",
              background: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "10px 24px",
              fontWeight: 600,
            }}
          >
            Continue
          </button>
        </div>
      )}

      {isRevealed && fatalError != null && (
        <div style={{ ...centeredOverlayStyle, background: "rgba(0,0,0,0.85)" }} role="alert">
          <p>Playback failed.</p>
          <button
            type="button"
            onClick={() => setRetryToken((t) => t + 1)}
            style={{
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 6,
              padding: "8px 16px",
              background: "transparent",
            }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
