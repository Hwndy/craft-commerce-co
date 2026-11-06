import { useEffect, useRef, useState, type CSSProperties } from "react";

import { siteMediaUrl } from "@/lib/storage";

import { useFilmControllerStore } from "./filmControllerStore";
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
  const isRevealed = useFilmControllerStore((s) => s.isRevealed);
  const isPrimed = useFilmControllerStore((s) => s.isPrimed);
  const fallback = useFilmControllerStore((s) => s.fallback);
  const start = useFilmControllerStore((s) => s.start);

  const { data: film } = useFilm();
  const masterUrl = film?.media.hlsMaster ? siteMediaUrl(film.media.hlsMaster) : null;
  const posterUrl = film?.media.posterPath ? siteMediaUrl(film.media.posterPath) : undefined;
  const captionsUrl = film?.captionsPath ? siteMediaUrl(film.captionsPath) : null;

  useEffect(() => {
    registerVideoElement(videoRef.current);
    return () => registerVideoElement(null);
  }, [registerVideoElement]);

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
