import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/brand/IconButton";
import { formatGbp, STATUS_COPY, STATUS_VARIANT } from "@/components/brand/ProductLabel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/features/enquiry/components/EnquiryForm";
import { buildMailtoLink } from "@/features/enquiry/lib/mailto";
import { attachHls } from "@/features/film/lib/hls";
import { exitFullscreenIfActive } from "@/features/film/lib/fullscreen";
import { env } from "@/lib/env";
import { siteMediaUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

import type { ProductDetail } from "./lib/queries";

export interface ProductOverlayProps {
  /** The requested slug (from the route) — null means "nothing open". */
  slug: string | null;
  /** undefined while the query for `slug` is still loading; null once it
   * resolves to "no such published product" (e.g. a stale/bad link). */
  product: ProductDetail | null | undefined;
  onClose: () => void;
}

function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * The product overlay (FR-4.3–FR-4.5, Phase 3 T3) — opened from a Shop node
 * or a direct /shop/:slug deep link (App.tsx redirects that into this same
 * /gallery/* splat so the persistent Board never remounts; see
 * galleryRoute.ts's productSlugFromSplat comment). Open state is entirely
 * derived from the route, same pattern as PhotoViewer.tsx: Gallery.tsx
 * passes `slug`/`product` down rather than this component keeping its own
 * open state, so browser Back closing it is free.
 *
 * Built directly on @radix-ui/react-dialog, not shadcn's preset Dialog
 * (whose classes assume a small centred box and nothing else) — the same
 * reasoning PhotoViewer.tsx already gives for why. One DOM tree styled two
 * ways via responsive Tailwind classes: a bottom sheet (full width, rounded
 * top corners, slides up) below the `sm` breakpoint, a centred card above
 * it — not two components, since nothing here needs genuinely different
 * interaction logic between the two, only layout.
 */
export function ProductOverlay({ slug, product, onClose }: ProductOverlayProps) {
  const [view, setView] = useState<"pictures" | "video">("pictures");
  const [pictureIndex, setPictureIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset to the gallery's first picture whenever a different product opens.
  useEffect(() => {
    setView("pictures");
    setPictureIndex(0);
    setShowForm(false);
  }, [slug]);

  // Defensive, not just a FilmStage-side fix: a Dialog portaled to body
  // (any z-index) can't be interacted with while the browser is in actual
  // Fullscreen-API mode on a *different* element — fullscreen content sits
  // in the browser's own top layer, above everything else regardless of
  // CSS stacking, so every click here would silently fail to hit-test at
  // all until it's exited. FilmStage no longer requests fullscreen for an
  // already-unlocked visit, but this guards the remaining real case too
  // (a genuine first watch, Continue clicked, fullscreen mid-exit) rather
  // than trusting that exit's own timing always wins the race.
  useEffect(() => {
    if (slug) void exitFullscreenIfActive();
  }, [slug]);

  const hasVideo = !!product?.video?.hlsMaster && !prefersReducedData();

  // FR-4.4: starts when visible (the Video tab is the one showing), pauses
  // when hidden (any other tab, or the dialog closes) — not a viewport
  // IntersectionObserver, since the whole dialog is either fully open or
  // unmounted, never partially scrolled off-screen.
  useEffect(() => {
    const video = videoRef.current;
    const masterUrl = product?.video?.hlsMaster;
    if (!video || !masterUrl || view !== "video") return;

    const controller = attachHls(video, siteMediaUrl(masterUrl), {
      // A turntable loop failing to play is never worth blocking the
      // overlay over — fall back to the picture gallery, same spirit as
      // FilmStage's own fallback chain but with nothing left to retry
      // automatically (there's no "Watch once" gate riding on this video).
      onFatalError: () => setView("pictures"),
    });
    void video.play().catch(() => {
      // Autoplay can be blocked even when muted on some browsers; the
      // poster frame (still shown via the <video poster> attribute until
      // playback starts) is an acceptable static fallback rather than
      // forcing a tap-to-play control onto a purely decorative loop.
    });
    return () => controller.destroy();
  }, [product?.video?.hlsMaster, view]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && view !== "video") video.pause();
  }, [view]);

  if (!slug) return null;

  const pictures = product?.pictures ?? [];
  const activePicture = pictures[pictureIndex] ?? product?.poster ?? null;
  const posterUrl = product?.poster?.renditions["1280"]
    ? siteMediaUrl(product.poster.renditions["1280"])
    : undefined;

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/80" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-[71] flex max-h-[90dvh] flex-col overflow-hidden rounded-t-2xl bg-surface-light text-surface-light-foreground outline-none",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[640px] sm:max-h-[85dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          )}
        >
          {/* Drag-handle affordance — decorative only (nothing here is
           * actually draggable yet, Escape/X/backdrop-click already close
           * it), mobile-only to read as "this is a sheet" per the mockup. */}
          <div className="flex justify-center pb-1 pt-2 sm:hidden" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-surface-light-foreground/20" />
          </div>

          {/* z-10: without an explicit stacking order, this absolutely
           * positioned wrapper and the picture area below it
           * (`position: relative`, for its own pagination-dot/toggle
           * overlays) are both "positioned, z-index: auto" — CSS stacks
           * those in DOM order, so the picture area (declared later)
           * painted over this button and silently ate every click/tap on
           * it, close-overlay keyboard/Escape still worked, X/tap did not
           * (found by reproducing a real CI e2e failure locally: Close
           * never actually received the click, elementFromPoint at its
           * center resolved to the picture div instead). */}
          <div className="absolute right-3 top-3 z-10">
            <DialogPrimitive.Close asChild>
              <IconButton aria-label="Close">×</IconButton>
            </DialogPrimitive.Close>
          </div>

          {/* flex-1 min-h-0 is load-bearing, not decorative: without an
           * explicit min-height, a flex child's default min-height:auto
           * stops it shrinking below its own content's natural size, so
           * this div would grow to fit everything instead of clipping at
           * the parent's max-h-[90dvh]/max-h-[85dvh] and scrolling
           * internally — the dialog (and, because that overflow was
           * making the whole document scrollable, the Board's own
           * ResizeObserver-driven viewport measurement) visibly "wobbled"
           * as a result (found in review). */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {product === undefined && (
              <div className="p-8 text-center">
                {/* Radix requires Title/Description whenever Content is open
                 * — sr-only here since "Loading…" has nothing worth a
                 * sighted heading, unlike the two states below. */}
                <DialogPrimitive.Title className="sr-only">Loading product</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  The product details are still loading.
                </DialogPrimitive.Description>
                <p className="text-sm text-surface-light-foreground/60" aria-hidden="true">
                  Loading…
                </p>
              </div>
            )}

            {product === null && (
              <div className="p-8 text-center">
                <DialogPrimitive.Title className="font-heading text-lg font-bold">
                  This item isn&apos;t available
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-surface-light-foreground/70">
                  It may have sold out or been taken off display.
                </DialogPrimitive.Description>
              </div>
            )}

            {product && (
              <>
                <div className="relative aspect-square w-full bg-black/10">
                  {view === "video" && hasVideo ? (
                    <video
                      ref={videoRef}
                      muted
                      loop
                      playsInline
                      poster={posterUrl}
                      className="h-full w-full object-cover"
                    />
                  ) : activePicture ? (
                    <img
                      src={siteMediaUrl(activePicture.renditions["1280"] ?? activePicture.storagePath)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {pictures.length > 1 && view === "pictures" && (
                    <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5" aria-hidden="true">
                      {pictures.map((picture, index) => (
                        <button
                          key={picture.id}
                          type="button"
                          tabIndex={-1}
                          onClick={() => setPictureIndex(index)}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full transition-colors",
                            index === pictureIndex ? "bg-primary" : "bg-black/30"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  {hasVideo && (
                    <div className="absolute left-2 top-2 flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant={view === "pictures" ? "pill" : "pill-outline"}
                        size="sm"
                        onClick={() => setView("pictures")}
                      >
                        Pictures
                      </Button>
                      <Button
                        type="button"
                        variant={view === "video" ? "pill" : "pill-outline"}
                        size="sm"
                        onClick={() => setView("video")}
                      >
                        Video
                      </Button>
                    </div>
                  )}
                </div>

                <div className="p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
                  <div className="flex items-baseline justify-between gap-3">
                    <DialogPrimitive.Title className="font-heading text-xl font-bold">
                      {product.name}
                    </DialogPrimitive.Title>
                    <span className="font-heading text-xl font-bold">
                      {formatGbp(product.priceAmount, product.priceCurrency)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge variant={STATUS_VARIANT[product.status]}>{STATUS_COPY[product.status]}</Badge>
                    {product.onSale && <Badge variant="outline">Sale</Badge>}
                  </div>

                  {product.bullets.length > 0 && (
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
                      {product.bullets.map((bullet, index) => (
                        <li key={index}>{bullet}</li>
                      ))}
                    </ul>
                  )}

                  <DialogPrimitive.Description className="mt-4 text-sm text-surface-light-foreground/70">
                    {product.description ?? product.name}
                  </DialogPrimitive.Description>

                  {/* T4 (FR-5.1) mailto purchase + T5 (FR-5.2–5.4) fallback
                   * form, toggled in place rather than a second nested
                   * dialog — avoids stacking Radix focus traps for what's
                   * still just one logical "purchase this" panel. C3
                   * (phases/PHASE-3-shop-and-enquiry.md): a sold item drops
                   * the mailto "Buy" action for "Ask about something
                   * similar", which opens the same form instead. */}
                  {showForm ? (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="mb-3 text-sm text-surface-light-foreground/70 underline underline-offset-2"
                      >
                        ← Back
                      </button>
                      <EnquiryForm productId={product.id} productName={product.name} />
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {product.status === "sold" ? (
                        <Button type="button" variant="pill" onClick={() => setShowForm(true)}>
                          Ask about something similar
                        </Button>
                      ) : (
                        <>
                          <Button asChild variant="pill">
                            <a
                              href={buildMailtoLink({
                                to: env.VITE_OWNER_EMAIL,
                                productName: product.name,
                                priceAmount: product.priceAmount,
                                priceCurrency: product.priceCurrency,
                                pageUrl: `${window.location.origin}/shop/${product.slug}`,
                              })}
                            >
                              Buy / Enquire
                            </a>
                          </Button>
                          <Button type="button" variant="pill-outline" onClick={() => setShowForm(true)}>
                            Use the form instead
                          </Button>
                        </>
                      )}
                      <Button
                        type="button"
                        variant="pill-outline"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(env.VITE_OWNER_EMAIL)
                            .then(() => toast("Email address copied"))
                            .catch(() => toast("Couldn't copy — the address is " + env.VITE_OWNER_EMAIL));
                        }}
                      >
                        Copy email address
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
