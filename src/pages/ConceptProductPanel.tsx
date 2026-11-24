import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGbp, STATUS_COPY, STATUS_VARIANT } from "@/components/brand/ProductLabel";
import { buildMailtoLink } from "@/features/enquiry/lib/mailto";
import { attachHls } from "@/features/film/lib/hls";
import { useProduct } from "@/features/shop/lib/useProducts";
import { env } from "@/lib/env";
import { siteMediaUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * The detail half of the concept pair (see ConceptProductGallery.tsx's own
 * doc comment for the full context) — one big, framed hero holding the
 * product's real turntable video, with floating chrome at its edges
 * echoing the client's reference site: a title chip and a way back at the
 * top, small playback toggles at the bottom-left, a brand mark at the
 * bottom-right. The commerce details (price, buy) sit in a slim strip
 * below rather than a big bright card, so the video stays the thing the
 * eye lands on first.
 *
 * Deliberately not a literal 3D/rotatable viewer — the earlier drag-to-
 * scrub prototype on this same turntable footage didn't add anything the
 * owner wanted (docs/decisions.md). This is still the plain autoplaying
 * loop ProductOverlay.tsx's own "Video" tab already plays; only the frame
 * around it changes here.
 */
export default function ConceptProductPanel() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useProduct(slug ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const hasVideo = !!product?.video && (!!product.video.hlsMaster || !!product.video.storagePath) && !prefersReducedData();

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasVideo || !product?.video) return;

    const tryPlay = () => void video.play()?.catch(() => {});

    if (product.video.hlsMaster) {
      const controller = attachHls(video, siteMediaUrl(product.video.hlsMaster));
      tryPlay();
      return () => controller.destroy();
    }

    video.src = siteMediaUrl(product.video.storagePath);
    tryPlay();
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [hasVideo, product?.video]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-foreground/60">
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load this piece.</p>
        <button
          type="button"
          className="rounded-full border border-foreground/20 px-4 py-1.5 text-xs font-semibold"
          onClick={() => refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
        <p className="font-heading text-lg font-bold">This item isn&apos;t available</p>
        <Link to="/concept/products" className="text-sm text-primary underline underline-offset-2">
          Back to all pieces
        </Link>
      </div>
    );
  }

  const posterUrl = product.poster?.renditions["1280"] ? siteMediaUrl(product.poster.renditions["1280"]) : undefined;

  return (
    <div className="min-h-screen bg-background p-4 text-foreground sm:p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-primary/40 px-3 py-1.5 font-heading text-xs font-semibold uppercase tracking-wider text-primary">
            {product.name}
          </span>
          <Link
            to="/concept/products"
            className="rounded-full border border-foreground/20 px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/10"
          >
            ‹ Back to Shop
          </Link>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-[28px] bg-[radial-gradient(120%_90%_at_50%_15%,#2a2a28_0%,#161615_55%,#0d0d0c_100%)]">
          {hasVideo ? (
            <video
              ref={videoRef}
              muted={isMuted}
              loop
              playsInline
              poster={posterUrl}
              className="h-full w-full object-cover"
            />
          ) : posterUrl ? (
            <img src={posterUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-foreground/30">No media</div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {hasVideo && (
                <>
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="sm"
                    aria-pressed={isPlaying}
                    onClick={() => {
                      const video = videoRef.current;
                      if (!video) return;
                      if (isPlaying) video.pause();
                      else void video.play()?.catch(() => {});
                      setIsPlaying(!isPlaying);
                    }}
                  >
                    {isPlaying ? "⏸" : "⏵"} Autoplay
                  </Button>
                  <Button
                    type="button"
                    variant="pill-outline"
                    size="sm"
                    aria-pressed={!isMuted}
                    onClick={() => setIsMuted((muted) => !muted)}
                  >
                    {isMuted ? "🔈" : "🔊"} Sound
                  </Button>
                </>
              )}
            </div>
            <span className="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-foreground/50">
              All Life
            </span>
          </div>
        </div>

        <div className={cn("flex flex-col gap-3 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5")}>
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="font-heading text-xl font-bold">{product.name}</h1>
            <span className="font-heading text-xl font-bold">{formatGbp(product.priceAmount, product.priceCurrency)}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant={STATUS_VARIANT[product.status]}>{STATUS_COPY[product.status]}</Badge>
            {product.onSale && <Badge variant="outline">Sale</Badge>}
          </div>

          {product.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/80">
              {product.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          )}

          <p className="text-sm text-foreground/70">{product.description ?? product.name}</p>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {product.status === "sold" ? (
              <span className="text-sm text-foreground/60">Sold — ask about something similar via the live Shop.</span>
            ) : (
              <Button asChild variant="pill">
                <a
                  href={buildMailtoLink({
                    to: env.VITE_OWNER_EMAIL,
                    productName: product.name,
                    priceAmount: product.priceAmount,
                    priceCurrency: product.priceCurrency,
                    pageUrl: `${window.location.origin}/shop/${product.slug}`,
                    bullets: product.bullets,
                  })}
                >
                  Buy / Enquire
                </a>
              </Button>
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
        </div>
      </div>
    </div>
  );
}
