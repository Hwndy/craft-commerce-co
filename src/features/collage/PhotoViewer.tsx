import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useGesture } from "@use-gesture/react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { siteMediaUrl } from "@/lib/storage";

import type { CollagePhoto } from "./lib/queries";
import { cyclePhotoId, renditionForScreenWidth } from "./lib/viewerNavigation";

export interface PhotoViewerProps {
  photos: CollagePhoto[];
  openId: string | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const SWIPE_DISTANCE_THRESHOLD_PX = 60;
const SWIPE_VELOCITY_THRESHOLD = 0.5;
const PRELOAD_COUNT = 2;

function usePreferredRendition() {
  const [width, setWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return renditionForScreenWidth(width);
}

function navButtonStyle(side: "left" | "right"): CSSProperties {
  return {
    position: "absolute",
    [side]: 16,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 40,
    lineHeight: 1,
    cursor: "pointer",
    padding: 16,
  };
}

/**
 * The full-screen photo viewer (docs/00-product-brief.md FR-3.3–3.6). Open
 * state is entirely derived from the route — Gallery.tsx passes `openId`
 * from /gallery/photo/:id rather than this component keeping its own open
 * state — so browser Back closing the viewer is free (the route change
 * unmounts it) and there's nothing to keep in sync.
 *
 * Built directly on @radix-ui/react-dialog (not the shadcn-styled Dialog
 * wrapper, whose preset classes assume a small centred box): Radix already
 * gives a focus trap, Escape-to-close, portal rendering, body-scroll lock
 * and return-focus-on-close for free. The portal also isolates every
 * pointer/wheel event in here from the Board's own gesture listeners by
 * construction — a portal is a different DOM subtree, so native events
 * never bubble through Board's element tree — which is what satisfies
 * "pinch inside the viewer doesn't move the board underneath" with no
 * stopPropagation needed.
 */
export function PhotoViewer({ photos, openId, onClose, onNavigate }: PhotoViewerProps) {
  const ids = photos.map((p) => p.id);
  const index = openId ? ids.indexOf(openId) : -1;
  const photo = index !== -1 ? photos[index] : null;
  const rendition = usePreferredRendition();
  const containerRef = useRef<HTMLDivElement>(null);
  // Gesture polish: tapping the image toggles the date caption and the
  // prev/next arrows for an unobstructed view — reset to visible whenever
  // a different photo opens. Close/Title stay put: the exit affordance and
  // accessible name shouldn't disappear on a stray tap.
  const [chromeVisible, setChromeVisible] = useState(true);
  useEffect(() => setChromeVisible(true), [photo?.id]);

  function goTo(delta: number) {
    if (!openId) return;
    const nextId = cyclePhotoId(ids, openId, delta);
    if (nextId) onNavigate(nextId);
  }

  useGesture(
    {
      onDragEnd: ({ movement: [mx], velocity: [vx], direction: [dirx] }) => {
        if (Math.abs(mx) < SWIPE_DISTANCE_THRESHOLD_PX && vx < SWIPE_VELOCITY_THRESHOLD) return;
        goTo(dirx > 0 ? -1 : 1);
      },
    },
    { target: containerRef, eventOptions: { passive: true } }
  );

  useEffect(() => {
    if (!photo) return;
    for (let step = 1; step <= PRELOAD_COUNT; step++) {
      const nextId = cyclePhotoId(ids, photo.id, step);
      const next = nextId ? photos.find((p) => p.id === nextId) : undefined;
      const path = next?.media.renditions[rendition];
      if (path) new Image().src = siteMediaUrl(path);
    }
    // `ids`/`photos` are re-derived from the same query data every render;
    // only the current photo and the chosen rendition should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id, rendition]);

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowLeft") goTo(-1);
    if (event.key === "ArrowRight") goTo(1);
  }

  if (!photo) return null;

  const renditionPath = photo.media.renditions[rendition];
  const src = renditionPath ? siteMediaUrl(renditionPath) : undefined;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 70 }} />
        <DialogPrimitive.Content
          ref={containerRef}
          onKeyDown={handleKeyDown}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 71,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            outline: "none",
          }}
        >
          <DialogPrimitive.Title style={{ position: "absolute", top: 16, left: 24, color: "#fff", fontSize: 16, margin: 0 }}>
            {photo.title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            style={
              !photo.takenOn
                // No date for this photo — Radix still wants an accessible
                // description (aria-describedby), so this stays in the a11y
                // tree without a visible, empty-looking caption line.
                ? { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }
                : {
                    position: "absolute",
                    top: 40,
                    left: 24,
                    color: "#ccc",
                    fontSize: 13,
                    margin: 0,
                    opacity: chromeVisible ? 1 : 0,
                    transition: "opacity 200ms",
                  }
            }
          >
            {photo.takenOn ?? photo.title}
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            aria-label="Close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 28,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </DialogPrimitive.Close>

          {photos.length > 1 && (
            <button
              type="button"
              aria-label="Previous photo"
              aria-hidden={!chromeVisible}
              tabIndex={chromeVisible ? 0 : -1}
              onClick={() => goTo(-1)}
              style={{
                ...navButtonStyle("left"),
                opacity: chromeVisible ? 1 : 0,
                pointerEvents: chromeVisible ? "auto" : "none",
                transition: "opacity 200ms",
              }}
            >
              ‹
            </button>
          )}

          {src && (
            <img
              src={src}
              alt=""
              onClick={() => setChromeVisible((visible) => !visible)}
              style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", cursor: "pointer" }}
            />
          )}

          {photos.length > 1 && (
            <button
              type="button"
              aria-label="Next photo"
              aria-hidden={!chromeVisible}
              tabIndex={chromeVisible ? 0 : -1}
              onClick={() => goTo(1)}
              style={{
                ...navButtonStyle("right"),
                opacity: chromeVisible ? 1 : 0,
                pointerEvents: chromeVisible ? "auto" : "none",
                transition: "opacity 200ms",
              }}
            >
              ›
            </button>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
