import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";

import { formatTime } from "../lib/formatTime";
import { actionForKey } from "../lib/keyboardShortcuts";
import { nextPlaybackRate } from "../lib/playbackRate";
import { useVideoState } from "../lib/useVideoState";
import { ScrubBar, type SpriteMeta } from "./ScrubBar";

export interface FilmControlsProps {
  video: HTMLVideoElement | null;
  spriteUrl?: string | null;
  spriteMeta?: SpriteMeta | null;
  /** Whether a <track kind="captions"> is actually mounted on `video` — the
   * CC button has nothing to toggle otherwise (docs/decisions.md D-45). */
  captionsAvailable?: boolean;
}

const AUTO_HIDE_MS = 3000;

/**
 * The custom control bar: play/pause, mute + volume (hidden where volume
 * writes don't stick, e.g. iOS), a scrub bar, captions and speed (D-45),
 * and the keyboard shortcuts from phases/PHASE-1-entry-to-film.md T9.
 * Auto-hides after 3s of inactivity, reappears on pointer movement/
 * activity or a keypress.
 */
export function FilmControls({ video, spriteUrl, spriteMeta, captionsAvailable }: FilmControlsProps) {
  const controls = useVideoState(video);
  const [visible, setVisible] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(() => video?.textTracks[0]?.mode === "showing");
  const hideTimerRef = useRef<number | null>(null);

  // Reads the track's real mode, both on mount and whenever it changes —
  // not just after this component's own toggleCaptions() call. FilmStage's
  // <video> is mounted once at the app root and never recreated, so a
  // visitor who enables CC, hits Continue, then reopens the film would
  // otherwise see the button start back at "off" while captions keep
  // showing (found in review, independently, by two reviewers).
  useEffect(() => {
    const track = video?.textTracks[0];
    if (!track) {
      setCaptionsOn(false);
      return;
    }
    setCaptionsOn(track.mode === "showing");
    const tracks = video.textTracks;
    const onChange = () => setCaptionsOn(track.mode === "showing");
    tracks.addEventListener("change", onChange);
    return () => tracks.removeEventListener("change", onChange);
  }, [video]);

  const toggleCaptions = useCallback(() => {
    const track = video?.textTracks[0];
    if (!track) return;
    track.mode = track.mode === "showing" ? "hidden" : "showing";
    // captionsOn updates via the "change" listener above, the single
    // source of truth for this state — not set directly here.
  }, [video]);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, []);

  const showControls = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const action = actionForKey(event.key);
      if (!action) return;
      event.preventDefault();
      showControls();
      switch (action.type) {
        case "toggle-play":
          controls.togglePlay();
          break;
        case "toggle-mute":
          controls.toggleMute();
          break;
        case "seek-relative":
          controls.seek(controls.currentTime + action.deltaSeconds);
          break;
        case "seek-to-start":
          controls.seek(0);
          break;
        case "seek-to-end":
          controls.seek(controls.duration);
          break;
        case "seek-to-percent":
          controls.seek((action.percent / 100) * controls.duration);
          break;
      }
    },
    [controls, showControls]
  );

  return (
    <div
      onPointerMove={showControls}
      onPointerDown={showControls}
      onKeyDown={handleKeyDown}
      className="absolute inset-0 flex flex-col justify-end"
    >
      <div
        className="flex flex-col gap-2 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300"
        style={{
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        <ScrubBar
          currentTime={controls.currentTime}
          duration={controls.duration}
          buffered={controls.buffered}
          onSeek={controls.seek}
          spriteUrl={spriteUrl}
          spriteMeta={spriteMeta}
        />
        <div className="flex items-center gap-3 text-white">
          <button
            type="button"
            onClick={controls.togglePlay}
            aria-label={controls.isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base text-black"
          >
            {controls.isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={controls.toggleMute}
            aria-label={controls.muted ? "Unmute" : "Mute"}
            className="flex h-8 w-8 shrink-0 items-center justify-center bg-transparent text-lg"
          >
            {controls.muted || controls.volume === 0 ? "🔇" : "🔊"}
          </button>
          {controls.volumeIsWritable && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={controls.muted ? 0 : controls.volume}
              onChange={(event) => controls.setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="w-20 accent-primary"
            />
          )}
          <span className="font-body text-xs tabular-nums text-white/80 sm:text-sm">
            {formatTime(controls.currentTime)} / {formatTime(controls.duration)}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {captionsAvailable && (
              <Button
                type="button"
                variant={captionsOn ? "pill" : "pill-outline"}
                size="sm"
                aria-pressed={captionsOn}
                onClick={toggleCaptions}
              >
                CC
              </Button>
            )}
            <Button
              type="button"
              variant="pill-outline"
              size="sm"
              onClick={() => controls.setPlaybackRate(nextPlaybackRate(controls.playbackRate))}
            >
              Speed {controls.playbackRate}×
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
