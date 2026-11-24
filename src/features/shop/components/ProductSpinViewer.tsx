import { useEffect, useRef, useState } from "react";

import { attachHls } from "@/features/film/lib/hls";
import { siteMediaUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

import { timeFromDrag, type SpinDragAnchor } from "../lib/spinDrag";
import type { ProductMedia } from "../lib/queries";

/** Prototype only (see docs/decisions.md): lets a visitor drag the
 * product's existing turntable video left/right to spin it themselves,
 * instead of just watching it autoplay on a loop (ProductOverlay.tsx's
 * existing "Video" tab, unchanged). Client inspo was an interactive-Earth
 * reference site built on a WebGL globe — not ported here, since a belt
 * isn't a sphere and this project has already twice ruled out adding a 3D
 * engine (D-04, the pixi.js clause in AGENTS.md) on bundle-budget
 * grounds. The same "grab it and spin it" *feel* is reachable for free
 * off footage this project already captures per product.
 *
 * Self-contained on purpose: duplicates ProductOverlay's own small
 * HLS-vs-direct-file video attach logic rather than factoring out a
 * shared hook, so this stays fully additive and easy to delete if the
 * owner/client don't want it — if it's adopted for real, that'd be the
 * first cleanup.
 */

/** How many horizontal pixels of drag correspond to one full loop of the
 * clip — scaled to the element's own rendered width in the pointermove
 * handler below, not a fixed pixel count (see spinDrag.ts's own comment on
 * why a fixed count would feel inconsistent across the mobile sheet vs.
 * the desktop card). This is the multiple of that width.
 */
const LOOP_WIDTHS = 2.5;

/** Idle auto-rotate speed, in loops per second, while nothing is being
 * dragged — slow and ambient, same spirit as the reference site's own
 * default-on "Earth rotation" (an invitation to interact, not a demand).
 */
const IDLE_LOOPS_PER_SECOND = 1 / 14;

/** Keyboard step, in seconds, per arrow-key press — for anyone who can't
 * drag. This prototype doesn't attempt a full ARIA slider (current-time
 * doesn't map cleanly to aria-valuenow for a looping clip); worth a real
 * accessibility pass before this ships, not just a prototype.
 */
const KEY_STEP_SECONDS = 0.3;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

export interface ProductSpinViewerProps {
  video: ProductMedia;
  posterUrl?: string;
  className?: string;
}

export function ProductSpinViewer({ video, posterUrl, className }: ProductSpinViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<SpinDragAnchor | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Attach the source — same hlsMaster/storagePath fallback shape as
  // ProductOverlay's own Video tab, deliberately not played/looped here:
  // this component drives currentTime itself instead.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (video.hlsMaster) {
      const controller = attachHls(el, siteMediaUrl(video.hlsMaster), {});
      return () => controller.destroy();
    }

    el.src = siteMediaUrl(video.storagePath);
    return () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
    };
  }, [video.hlsMaster, video.storagePath]);

  // Idle auto-rotate: nudges currentTime forward slowly whenever nothing
  // is being dragged. Skipped entirely under prefers-reduced-motion —
  // the clip still sits there, still drag/keyboard-spinnable on purpose
  // (that's a deliberate visitor action, not autoplaying motion), it just
  // never moves on its own. AGENTS.md rule 6.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame: number;
    let last = performance.now();

    function tick(now: number) {
      const el = videoRef.current;
      const dt = (now - last) / 1000;
      last = now;
      if (el && !draggingRef.current && el.duration > 0 && Number.isFinite(el.duration)) {
        const advance = dt * IDLE_LOOPS_PER_SECOND * el.duration;
        el.currentTime = (el.currentTime + advance) % el.duration;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.pause();
    draggingRef.current = { startX: event.clientX, startTime: el.currentTime };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const anchor = draggingRef.current;
    const el = videoRef.current;
    const container = containerRef.current;
    if (!anchor || !el || !container) return;
    const pixelsPerLoop = container.clientWidth * LOOP_WIDTHS;
    el.currentTime = timeFromDrag(anchor, event.clientX, el.duration, pixelsPerLoop);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    el.pause();
    const step = event.key === "ArrowRight" ? -KEY_STEP_SECONDS : KEY_STEP_SECONDS;
    let t = (el.currentTime + step) % el.duration;
    if (t < 0) t += el.duration;
    el.currentTime = t;
  }

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Drag left or right, or use the arrow keys, to spin the product video"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={cn("relative h-full w-full select-none touch-none", isDragging ? "cursor-grabbing" : "cursor-grab", className)}
    >
      <video ref={videoRef} muted playsInline poster={posterUrl} className="pointer-events-none h-full w-full object-cover" />
    </div>
  );
}
