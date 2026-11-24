/** Prototype (client inspo: an interactive-Earth-globe reference site —
 * see docs/decisions.md for the writeup) for a "drag the turntable video
 * to spin it yourself" product view. Kept as a pure function, separate
 * from ProductSpinViewer.tsx's own pointer/video wiring, so the actual
 * drag-to-time mapping — the one part worth unit testing — doesn't need
 * a real <video> element or pointer events to verify.
 */

export interface SpinDragAnchor {
  /** The clientX at drag start. */
  startX: number;
  /** video.currentTime at drag start. */
  startTime: number;
}

/** How many horizontal pixels of drag correspond to one full loop of the
 * video. Smaller = more sensitive (a short drag spins the whole way
 * round); larger = a slower, more deliberate spin. Exposed as a parameter
 * (not a hardcoded constant) so ProductSpinViewer can scale it to the
 * element's own rendered width — a fixed pixel count would feel
 * different on a 320px phone sheet vs. the 640px desktop card.
 */
export function timeFromDrag(anchor: SpinDragAnchor, clientX: number, duration: number, pixelsPerLoop: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || pixelsPerLoop <= 0) return anchor.startTime;

  const deltaX = clientX - anchor.startX;
  const deltaTime = (deltaX / pixelsPerLoop) * duration;

  // Drag right -> time runs backward. This reads as "pulling" the face of
  // the product that's on the right of frame around towards you, which is
  // the convention most 360-product-viewer sites settle on — but it's a
  // feel judgement, not a technical one, and the real footage isn't in
  // this sandbox to check it against. Flip the sign here (one line) once
  // someone's actually watched it drag against a real turntable clip.
  let t = anchor.startTime - deltaTime;

  // Wrap into [0, duration) rather than clamping — the clip loops, so
  // dragging past either end should keep spinning, not stop dead.
  t %= duration;
  if (t < 0) t += duration;
  return t;
}
