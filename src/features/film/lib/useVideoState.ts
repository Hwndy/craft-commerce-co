import { useCallback, useEffect, useState } from "react";

import { timeRangesToArray, type Range } from "./timeRanges";

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: Range[];
  volume: number;
  muted: boolean;
  /** false on iOS, where writes to .volume are silently ignored. */
  volumeIsWritable: boolean;
}

export interface VideoControls extends VideoState {
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
}

const SYNCED_EVENTS = [
  "play",
  "pause",
  "timeupdate",
  "durationchange",
  "progress",
  "volumechange",
  "ended",
] as const;

export function useVideoState(video: HTMLVideoElement | null): VideoControls {
  const [state, setState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    buffered: [],
    volume: 1,
    muted: false,
    volumeIsWritable: true,
  });

  useEffect(() => {
    if (!video) return;

    const originalVolume = video.volume;
    const probeValue = originalVolume === 0.5 ? 0.6 : 0.5;
    video.volume = probeValue;
    const volumeIsWritable = video.volume === probeValue;
    video.volume = originalVolume;

    function sync() {
      if (!video) return;
      setState({
        isPlaying: !video.paused && !video.ended,
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        buffered: timeRangesToArray(video.buffered),
        volume: video.volume,
        muted: video.muted,
        volumeIsWritable,
      });
    }

    sync();
    for (const event of SYNCED_EVENTS) video.addEventListener(event, sync);
    return () => {
      for (const event of SYNCED_EVENTS) video.removeEventListener(event, sync);
    };
  }, [video]);

  const togglePlay = useCallback(() => {
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }, [video]);

  const seek = useCallback(
    (time: number) => {
      if (!video) return;
      const duration = Number.isFinite(video.duration) ? video.duration : time;
      const clamped = Math.max(0, Math.min(time, duration));
      if (typeof video.fastSeek === "function") {
        video.fastSeek(clamped);
      } else {
        video.currentTime = clamped;
      }
    },
    [video]
  );

  const setVolume = useCallback(
    (value: number) => {
      if (!video) return;
      video.volume = Math.max(0, Math.min(1, value));
      if (video.volume > 0) video.muted = false;
    },
    [video]
  );

  const toggleMute = useCallback(() => {
    if (!video) return;
    video.muted = !video.muted;
  }, [video]);

  return { ...state, togglePlay, seek, setVolume, toggleMute };
}
