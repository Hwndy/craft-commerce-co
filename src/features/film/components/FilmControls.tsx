import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { formatTime } from "../lib/formatTime";
import { actionForKey } from "../lib/keyboardShortcuts";
import { useVideoState } from "../lib/useVideoState";
import { ScrubBar, type SpriteMeta } from "./ScrubBar";

export interface FilmControlsProps {
  video: HTMLVideoElement | null;
  spriteUrl?: string | null;
  spriteMeta?: SpriteMeta | null;
}

const AUTO_HIDE_MS = 3000;

/**
 * The custom control bar: play/pause, mute + volume (hidden where volume
 * writes don't stick, e.g. iOS), a scrub bar, and the keyboard shortcuts
 * from phases/PHASE-1-entry-to-film.md T9. Auto-hides after 3s of
 * inactivity, reappears on pointer movement/activity or a keypress.
 */
export function FilmControls({ video, spriteUrl, spriteMeta }: FilmControlsProps) {
  const controls = useVideoState(video);
  const [visible, setVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

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
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
    >
      <div
        style={{
          padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
          <button
            type="button"
            onClick={controls.togglePlay}
            aria-label={controls.isPlaying ? "Pause" : "Play"}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
          >
            {controls.isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={controls.toggleMute}
            aria-label={controls.muted ? "Unmute" : "Mute"}
            style={{ background: "none", border: "none", color: "#fff", fontSize: 18, cursor: "pointer" }}
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
              style={{ width: 80 }}
            />
          )}
          <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
            {formatTime(controls.currentTime)} / {formatTime(controls.duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
