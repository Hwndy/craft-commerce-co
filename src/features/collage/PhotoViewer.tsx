import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useGesture } from "@use-gesture/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { cn } from "@/lib/utils";
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
const FILMSTRIP_RENDITION = "256";

function usePreferredRendition() {
  const [width, setWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return renditionForScreenWidth(width);
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
 *
 * DialogPrimitive.Title/Description still provide the dialog's real
 * accessible name/description (Radix requires them), but are positioned at
 * the bottom-left per the mockup (docs/decisions.md D-45) — their DOM
 * position has no bearing on that. The "n / total · Shoot" counter above
 * them is purely decorative (aria-hidden): screen reader users already get
 * the equivalent via the dialog's own accessible name/description and the
 * Next/Previous buttons' names.
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
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/90" />
        <DialogPrimitive.Content
          ref={containerRef}
          onKeyDown={handleKeyDown}
          className="fixed inset-0 z-[71] flex flex-col font-body text-white outline-none"
        >
          {photos.length > 1 && (
            <p aria-hidden="true" className="absolute left-6 top-4 text-xs tracking-wide text-white/70">
              {index + 1} / {photos.length} · {photo.shoot.title}
            </p>
          )}

          <div className="absolute right-4 top-4">
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close">×</IconButton>
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-1 items-center justify-center px-4">
            {photos.length > 1 && (
              <IconButton
                aria-label="Previous photo"
                aria-hidden={!chromeVisible}
                tabIndex={chromeVisible ? 0 : -1}
                onClick={() => goTo(-1)}
                size="lg"
                className={cn(
                  "absolute left-4 top-1/2 -translate-y-1/2 transition-opacity duration-200",
                  chromeVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                ‹
              </IconButton>
            )}

            {src && (
              <img
                src={src}
                alt=""
                onClick={() => setChromeVisible((visible) => !visible)}
                className="max-h-[70vh] max-w-[90vw] cursor-pointer object-contain"
              />
            )}

            {photos.length > 1 && (
              <IconButton
                aria-label="Next photo"
                aria-hidden={!chromeVisible}
                tabIndex={chromeVisible ? 0 : -1}
                onClick={() => goTo(1)}
                size="lg"
                className={cn(
                  "absolute right-4 top-1/2 -translate-y-1/2 transition-opacity duration-200",
                  chromeVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                ›
              </IconButton>
            )}
          </div>

          <div className="flex items-end justify-between gap-3 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <div>
              <DialogPrimitive.Title className="m-0 font-heading text-lg font-bold">{photo.title}</DialogPrimitive.Title>
              <DialogPrimitive.Description
                className={cn(
                  "m-0 text-sm text-white/60 transition-opacity duration-200",
                  // No date for this photo — Radix still wants an accessible
                  // description (aria-describedby), so it falls back to the
                  // title as the described-by text, but stays out of view
                  // (sr-only) rather than visibly repeating the title line
                  // right under itself.
                  photo.takenOn ? (chromeVisible ? "opacity-100" : "opacity-0") : "sr-only"
                )}
              >
                {photo.takenOn ?? photo.title}
              </DialogPrimitive.Description>
            </div>

            {photos.length > 1 && (
              <div className="hidden items-center gap-1.5 overflow-x-auto sm:flex" aria-hidden="true">
                {photos.map((p) => {
                  const thumbSrc = p.media.renditions[FILMSTRIP_RENDITION];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      tabIndex={-1}
                      onClick={() => onNavigate(p.id)}
                      className={cn(
                        "h-12 w-12 shrink-0 overflow-hidden rounded border-2 bg-black/40 bg-cover bg-center transition-colors",
                        p.id === photo.id ? "border-primary" : "border-transparent hover:border-white/30"
                      )}
                      style={thumbSrc ? { backgroundImage: `url(${siteMediaUrl(thumbSrc)})` } : undefined}
                    />
                  );
                })}
              </div>
            )}

            <p className="hidden shrink-0 text-xs text-white/50 md:block">Swipe or ← → · Esc to close</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
