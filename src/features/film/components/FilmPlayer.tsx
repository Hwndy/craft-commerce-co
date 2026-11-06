import { useEffect, useRef, useState, type CSSProperties } from "react";

import { siteMediaUrl } from "@/lib/storage";

import { attachHls } from "../lib/hls";
import { useFilm } from "../lib/useFilm";

export interface FilmPlayerProps {
  className?: string;
  style?: CSSProperties;
}

const containerStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  background: "#000",
};

const videoStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
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
 * Core film player: hls.js / native HLS, branded poster, captions track
 * when present, a buffering ring, and fatal-error recovery with a visible
 * retry. Custom scrub/play/pause/volume controls are T9's job — this uses
 * the browser's native `controls` for now.
 */
export function FilmPlayer({ className, style }: FilmPlayerProps) {
  const { data: film, isLoading, isError } = useFilm();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [fatalError, setFatalError] = useState<unknown>(null);
  const [retryToken, setRetryToken] = useState(0);

  const masterUrl = film?.media.hlsMaster ? siteMediaUrl(film.media.hlsMaster) : null;
  const posterUrl = film?.media.posterPath ? siteMediaUrl(film.media.posterPath) : undefined;
  const captionsUrl = film?.captionsPath ? siteMediaUrl(film.captionsPath) : null;

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

  if (isLoading) {
    return (
      <div className={className} style={{ ...containerStyle, ...style }} aria-busy="true">
        <div style={centeredOverlayStyle}>
          <div className="buffering-ring" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (isError || !film || !masterUrl) {
    return (
      <div className={className} style={{ ...containerStyle, ...style }}>
        <div style={centeredOverlayStyle} role="status">
          <p>The film isn&apos;t available right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ ...containerStyle, ...style }}>
      <video
        ref={videoRef}
        controls
        playsInline
        poster={posterUrl}
        style={videoStyle}
        aria-label={film.title}
      >
        {captionsUrl && (
          <track kind="captions" src={captionsUrl} srcLang="en" label="English" />
        )}
      </video>

      {isBuffering && !fatalError && (
        <div style={{ ...centeredOverlayStyle, pointerEvents: "none" }} aria-hidden="true">
          <div className="buffering-ring" />
        </div>
      )}

      {fatalError != null && (
        <div style={{ ...centeredOverlayStyle, background: "rgba(0, 0, 0, 0.85)" }} role="alert">
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
