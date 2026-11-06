import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { formatTimeVerbose } from "../lib/formatTime";
import type { SpriteMeta } from "../lib/queries";
import type { Range } from "../lib/timeRanges";

export type { SpriteMeta };

export interface ScrubBarProps {
  currentTime: number;
  duration: number;
  buffered: Range[];
  onSeek: (time: number) => void;
  spriteUrl?: string | null;
  spriteMeta?: SpriteMeta | null;
}

/**
 * Accessible scrub bar: buffered ranges, sprite thumbnail while dragging,
 * currentTime applied at most once per animation frame while dragging
 * (phases/PHASE-1-entry-to-film.md T9).
 */
export function ScrubBar({
  currentTime,
  duration,
  buffered,
  onSeek,
  spriteUrl,
  spriteMeta,
}: ScrubBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [previewTime, setPreviewTime] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const scheduleSeek = useCallback(
    (time: number) => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        onSeek(time);
      });
    },
    [onSeek]
  );

  const handlePointerMove = useCallback(
    (clientX: number, dragging: boolean) => {
      const time = timeFromClientX(clientX);
      setPreviewTime(time);
      if (dragging) scheduleSeek(time);
    },
    [timeFromClientX, scheduleSeek]
  );

  const spriteStyle = (() => {
    if (!spriteUrl || !spriteMeta || previewTime === null) return null;
    const totalFrames = spriteMeta.cols * spriteMeta.rows;
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.max(0, Math.floor(previewTime / spriteMeta.interval))
    );
    const col = frameIndex % spriteMeta.cols;
    const row = Math.floor(frameIndex / spriteMeta.cols);
    return {
      width: spriteMeta.w,
      height: spriteMeta.h,
      backgroundImage: `url(${spriteUrl})`,
      backgroundPosition: `-${col * spriteMeta.w}px -${row * spriteMeta.h}px`,
      backgroundRepeat: "no-repeat" as const,
    };
  })();

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {previewTime !== null && spriteStyle && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 28,
            left: `${duration > 0 ? (previewTime / duration) * 100 : 0}%`,
            transform: "translateX(-50%)",
            border: "2px solid #fff",
            borderRadius: 4,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div style={spriteStyle} />
        </div>
      )}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatTimeVerbose(currentTime)} of ${formatTimeVerbose(duration)}`}
        style={{
          position: "relative",
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.25)",
          cursor: "pointer",
        }}
        onPointerDown={(event: ReactPointerEvent<HTMLDivElement>) => {
          setIsDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointerMove(event.clientX, true);
        }}
        onPointerMove={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (isDragging) handlePointerMove(event.clientX, true);
        }}
        onPointerUp={(event: ReactPointerEvent<HTMLDivElement>) => {
          setIsDragging(false);
          setPreviewTime(null);
          onSeek(timeFromClientX(event.clientX));
        }}
        onPointerLeave={() => {
          if (!isDragging) setPreviewTime(null);
        }}
      >
        {buffered.map((range) => (
          <div
            key={`${range.start}-${range.end}`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: duration > 0 ? `${(range.start / duration) * 100}%` : 0,
              width: duration > 0 ? `${((range.end - range.start) / duration) * 100}%` : 0,
              background: "rgba(255,255,255,0.4)",
              borderRadius: 3,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${percent}%`,
            background: "#C9A64B",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
