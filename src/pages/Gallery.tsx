import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Board } from "@/canvas/Board";
import { CanvasChrome } from "@/canvas/CanvasChrome";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { cameraFromCenter } from "@/canvas/math";
import { cameraForViewpoint, getViewpoint, OVERVIEW_VIEWPOINT } from "@/canvas/viewpoints";
import { RegionLabel } from "@/components/brand/RegionLabel";
import { Collage } from "@/features/collage/Collage";
import { CollageChrome } from "@/features/collage/CollageChrome";
import { photoIdsInSameStack } from "@/features/collage/lib/layout";
import { useCollagePhotos } from "@/features/collage/lib/useCollagePhotos";
import { PhotoViewer } from "@/features/collage/PhotoViewer";
import { Contact } from "@/features/contact/Contact";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";
import { useGateStore } from "@/features/film/gateStore";
import { useFilm } from "@/features/film/lib/useFilm";
import { useProduct } from "@/features/shop/lib/useProducts";
import { ProductOverlay } from "@/features/shop/ProductOverlay";
import { ShopChrome } from "@/features/shop/ShopChrome";
import { ShopRegion } from "@/features/shop/ShopRegion";
import { siteMediaUrl } from "@/lib/storage";

import { initialViewpointKeyFromSplat, photoIdFromSplat, productSlugFromSplat } from "./galleryRoute";

/**
 * Despite the name/route, this page now hosts the *whole* spatial board —
 * Gallery (film), Collage, both Shop regions (T2), and About/Contact (T6)
 * — all on the same persistent `<Board>`, because App.tsx only mounts one
 * `<Board>` anywhere, under `/gallery/*`; there's no separate always-mounted
 * board for every route to share. Each area's own viewpoint (supabase/
 * seed.sql) is what Explore-mode panning and Guided-mode Next/Previous
 * actually move between, with no route change needed. Renaming this
 * page/route is a reasonable future cleanup, but is out of scope for any
 * one task to do incidentally.
 *
 * The Gallery region (the film) plus the Collage region (T8) specifically:
 * "gallery" and "collage" are two distinct viewpoints within the one
 * product-brief "Gallery" area (film + photo collage). The film itself
 * renders via FilmStage's globally-mounted full-screen layer (T8 of
 * Phase 1), not inside this component — reveal()/hide() here just toggle
 * that layer on/off, so the single <video> element is never recreated by
 * route changes and the first-watch gate can never be bypassed by
 * navigating away and back: its state lives in gateStore/localStorage,
 * independent of this route's mount lifecycle.
 *
 * T9's photo viewer deep link (/gallery/photo/:id) is handled by the same
 * single App.tsx route (a splat, "/gallery/*") rather than a second <Route>
 * — see App.tsx's comment for why: two separate routes rendering the same
 * element still remount it on navigation between them, which would reset
 * the camera and re-trigger reveal()/hide() every time the viewer opens or
 * closes. photoIdFromSplat() reads the optional "photo/:id" tail.
 */
export default function Gallery() {
  const { data: film } = useFilm();
  const { data: photos } = useCollagePhotos();
  const posterUrl = film?.media.posterPath ? siteMediaUrl(film.media.posterPath) : undefined;
  const navigate = useNavigate();
  const params = useParams();
  const requestedPhotoId = photoIdFromSplat(params["*"]);
  const requestedProductSlug = productSlugFromSplat(params["*"]);
  const requestedViewpointKey = initialViewpointKeyFromSplat(params["*"]);
  const isUnlocked = useGateStore((s) => s.isUnlocked);
  const isFilmRevealed = useFilmControllerStore((s) => s.isRevealed);
  // T10 (D-07): a direct /gallery/photo/:id visit still has to earn the
  // unlock first if there's a film to gate on this device — reveal() below
  // always shows the film regardless, so the viewer only needs to stay
  // closed until isUnlocked catches up. The URL (and therefore which photo
  // is requested) is left alone, so the moment the gate opens — either now
  // or from actually watching — the viewer opens on exactly the photo the
  // link pointed at, with no redirect needed. A direct /shop/:slug deep
  // link (T3) is gated the same way, for the same reason: the film's
  // full-screen locked layer already covers the whole page regardless of
  // which content the URL points at.
  const openPhotoId = !film || isUnlocked ? requestedPhotoId : null;
  const openProductSlug = !film || isUnlocked ? requestedProductSlug : null;
  const { data: product } = useProduct(openProductSlug ?? "");

  // Client feedback (docs/decisions.md D-71): "each column will have its
  // own cycle, they should not be grouped" — the viewer cycles within the
  // opened photo's own strips stack/column, not every published photo.
  // `photos` must stay in the exact order Collage.tsx laid them out in
  // (the full, unfiltered list) for the stack grouping to match what was
  // actually on screen.
  const viewerPhotos = useMemo(() => {
    const all = photos ?? [];
    if (!openPhotoId) return all;
    const scopedIds = photoIdsInSameStack(
      all.map((p) => p.id),
      openPhotoId
    );
    const byId = new Map(all.map((p) => [p.id, p]));
    return scopedIds.map((id) => byId.get(id)!).filter(Boolean);
  }, [photos, openPhotoId]);

  // A ref, not a dependency: this effect must run exactly once, on mount
  // (same reasoning as reveal()/hide() below) — only the splat's *initial*
  // value should ever decide where the camera first lands, not a changing
  // one re-running this effect on every navigation within /gallery/*.
  const initialViewpointKeyRef = useRef(requestedViewpointKey);
  useEffect(() => {
    const { viewport, setCamera } = useCameraStore.getState();
    const requestedKey = initialViewpointKeyRef.current;
    // No specific region was requested (a plain /gallery visit, not a
    // direct /contact, /gallery/photo/:id or /gallery/shop/:slug link) —
    // land on a wide, zoomed-out view of the whole board (docs/
    // decisions.md D-71, Step 6) instead of always defaulting to the
    // Gallery/film quadrant specifically.
    if (!requestedKey) {
      setCamera(cameraFromCenter(OVERVIEW_VIEWPOINT, OVERVIEW_VIEWPOINT.zoom, viewport.width, viewport.height));
      return;
    }
    setCamera(cameraForViewpoint(getViewpoint(requestedKey), viewport));
  }, []);

  useEffect(() => {
    // revealAutomatically(), not reveal(): T6 — FilmStage uses that
    // distinction to dismiss itself once it's confirmed this reveal
    // doesn't need watching, without ever doing the same to a visitor's
    // own explicit "watch the film" click (RegionLabel's onClick below).
    //
    // Found as a real, reproduced bug (not a review finding): this ran
    // unconditionally on every mount, including the one right after
    // LandingVideo's own handleDone already called the real, explicit
    // reveal() (+ start()) moments earlier, just before
    // navigate("/gallery"). On a device that has already watched the
    // film before (isUnlocked persisted in localStorage from an earlier
    // visit), overwriting isAutomaticReveal back to true here made
    // FilmStage's own already-unlocked-automatic-reveal effect fire
    // immediately and hide() the film again — cancelling the very reveal
    // the visitor had just explicitly clicked through the whole entry
    // sequence to watch, dropping them straight onto the board instead.
    // Only mark this reveal automatic if nothing has revealed the film
    // yet: a genuinely fresh mount (a direct /gallery deep link, or
    // returning after the cleanup below already hid it) keeps the
    // original, correct behaviour; one that arrives already revealed
    // leaves that explicit intent alone.
    if (!useFilmControllerStore.getState().isRevealed) {
      useFilmControllerStore.getState().revealAutomatically();
    }
    return () => {
      // Leaving /gallery (back button, etc.) always drops the full-screen
      // layer — it has no business covering a different route. The gate's
      // own locked/unlocked state is untouched by this.
      useFilmControllerStore.getState().hide();
    };
  }, []);

  return (
    <>
      <Board>
        <Region id="gallery" title="Gallery" x={1600} y={-300} width={800} height={600}>
          {/* Board quadrant card (docs/decisions.md D-45) — the region's
              poster image fills the card's own background rather than
              sitting in RegionLabel's icon tile, so the whole 800x600
              region stays one large, clickable poster as before.

              Corrected (found by axe's label-content-name-mismatch in CI,
              not caught by the comment this replaces): a composed
              aria-label is NOT guaranteed to contain the button's actual
              visible text just because it's written to look like it does
              — title/subtitle render as two separate text nodes with no
              real space or comma between them (the gap is CSS flex `gap`,
              not text), so the real accessible-name check sees
              "GalleryFilm · Collage" with no separator, which a
              comma-and-space-containing aria-label like "Gallery, Film ·
              Collage — …" does not literally contain. Omitting aria-label
              lets the button's name come from its own visible content
              instead (guaranteed to contain it, by construction); the
              extra "play X" context goes in a visually-hidden span inside
              the button so sighted and screen-reader users both get the
              same real information, just the first visually, the second
              read aloud — worded to avoid literally repeating "Play the
              film", which e2e/gate.spec.ts already uses (Playwright's
              getByRole name match is substring by default) to find
              FilmStage's own, unrelated play-button fallback; that
              element and this card are both in the DOM at once (Board
              mounts unconditionally; FilmStage is a separate overlay), so
              an exact phrase collision would make that locator ambiguous. */}
          <RegionLabel
            onClick={() => useFilmControllerStore.getState().reveal()}
            title="Gallery"
            subtitle="Film · Collage"
            className="h-full w-full justify-end bg-cover bg-center"
            style={{
              backgroundImage: posterUrl
                ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1) 60%), url(${posterUrl})`
                : undefined,
              backgroundColor: posterUrl ? undefined : "#111",
            }}
          >
            <span className="sr-only">
              {film ? `Starts ${film.title} playing` : "Starts the film playing"}
            </span>
          </RegionLabel>
        </Region>

        <Collage
          centerX={getViewpoint("collage").x}
          centerY={getViewpoint("collage").y}
          onOpenPhoto={(id) => navigate(`/gallery/photo/${id}`)}
        />

        {/* Phase 3 T2 — the Shop region lives on the same persistent Board
         * as Gallery/Collage, same reasoning as Collage's own comment
         * above: Explore-mode panning and Guided-mode Next/Previous move
         * between every region without a route change. onOpenProduct
         * navigates within this same /gallery/* splat (T3's ProductOverlay
         * reads the slug back out via productSlugFromSplat) rather than to
         * a real top-level /shop/:slug route, for the exact same remount
         * reason the photo viewer's own deep link does (App.tsx's comment)
         * — a bare /shop/:slug link (bookmarked/shared) still works, via
         * App.tsx's redirect into this same splat before Gallery mounts.
         *
         * One mount, not two (docs/decisions.md D-71's "sixth correction")
         * — the owner's own design is one continuous room, not two
         * separately-navigable copies of it. "shop-wall" and "shop-floor"
         * are still two distinct viewpoints (CanvasChrome's guided path,
         * the minimap, /list), both now pointing at this single region's
         * own centre (supabase/migrations/0008). */}
        <ShopRegion
          title="Shop"
          centerX={getViewpoint("shop-wall").x}
          centerY={getViewpoint("shop-wall").y}
          onOpenProduct={(slug) => navigate(`/gallery/shop/${slug}`)}
          // The room's own fixed capacity (ShopRoomScene.tsx) routes
          // whatever doesn't fit to the plain, uncapped list for that zone
          // — a real top-level route (ListRegion.tsx), not this splat, so
          // this is a genuine navigation away from the board, by design.
          onViewAllWall={() => navigate("/list/shop-wall")}
          onViewAllFloor={() => navigate("/list/shop-floor")}
        />

        {/* T6: real content at its own world position, same precedent as
         * Collage/Shop above — no modal to open, so nothing extra to wire
         * through onOpenProduct-style callbacks. (About was removed
         * outright in docs/decisions.md D-71, Step 9 — the seal itself
         * now holds the board's "middle" spot Step 6 centred everything
         * else around.) */}
        <Contact centerX={getViewpoint("contact").x} centerY={getViewpoint("contact").y} />

        <PhotoViewer
          photos={viewerPhotos}
          openId={openPhotoId}
          onClose={() => navigate("/gallery", { replace: true })}
          onNavigate={(id) => navigate(`/gallery/photo/${id}`, { replace: true })}
        />

        <ProductOverlay
          slug={openProductSlug}
          product={openProductSlug ? product : null}
          onClose={() => navigate("/gallery", { replace: true })}
        />
      </Board>

      {/*
       * T10: CanvasChrome (minimap, Home, List view, Guided/Explore +
       * Next/Previous) was deliberately left unwired by T5 specifically
       * because it would overlay FilmStage's full-screen film (its own
       * z-index 60 sits above FilmStage's revealed-layer z-index 50) and
       * let a visitor navigate away before ever earning the unlock — the
       * exact bypass the gate exists to prevent. isFilmRevealed is true
       * for the film's entire time on screen, locked or not (it only drops
       * once Continue calls hide()), so gating on it alone — rather than
       * re-deriving isLocked here too — is both correct and simpler.
       *
       * Rendered as a SIBLING of <Board>, not a child: CanvasChrome's (and
       * CollageChrome's, D-45) own `position: fixed` chrome needs the real
       * viewport as its containing block. Board's own world div carries a
       * `transform` (its rAF camera loop) and `will-change: transform`,
       * either of which redefines the containing block for any
       * `position: fixed` descendant — nesting this chrome inside <Board>'s
       * children would silently move it with the camera instead of keeping
       * it screen-anchored. DevCanvas.tsx already established this exact
       * sibling placement; this just follows it.
       */}
      {!isFilmRevealed && (
        <>
          <CanvasChrome />
          <CollageChrome />
          <ShopChrome />
        </>
      )}
    </>
  );
}
