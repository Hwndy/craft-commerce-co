import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Board } from "@/canvas/Board";
import { CanvasChrome } from "@/canvas/CanvasChrome";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint } from "@/canvas/viewpoints";
import { RegionLabel } from "@/components/brand/RegionLabel";
import { Collage } from "@/features/collage/Collage";
import { CollageChrome } from "@/features/collage/CollageChrome";
import { useCollagePhotos } from "@/features/collage/lib/useCollagePhotos";
import { PhotoViewer } from "@/features/collage/PhotoViewer";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";
import { useGateStore } from "@/features/film/gateStore";
import { useFilm } from "@/features/film/lib/useFilm";
import { siteMediaUrl } from "@/lib/storage";

import { photoIdFromSplat } from "./galleryRoute";

/**
 * The Gallery region (the film) plus the Collage region (T8), both on the
 * same persistent Board so Explore-mode panning and Guided-mode Next/
 * Previous move between them without a route change — "gallery" and
 * "collage" are two distinct viewpoints (supabase/seed.sql) within the
 * one product-brief "Gallery" area (film + photo collage). The film itself
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
  const isUnlocked = useGateStore((s) => s.isUnlocked);
  const isFilmRevealed = useFilmControllerStore((s) => s.isRevealed);
  // T10 (D-07): a direct /gallery/photo/:id visit still has to earn the
  // unlock first if there's a film to gate on this device — reveal() below
  // always shows the film regardless, so the viewer only needs to stay
  // closed until isUnlocked catches up. The URL (and therefore which photo
  // is requested) is left alone, so the moment the gate opens — either now
  // or from actually watching — the viewer opens on exactly the photo the
  // link pointed at, with no redirect needed.
  const openPhotoId = !film || isUnlocked ? requestedPhotoId : null;

  useEffect(() => {
    useCameraStore.getState().setCamera(getViewpoint("gallery"));
  }, []);

  useEffect(() => {
    useFilmControllerStore.getState().reveal();
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
              aria-label must still contain the card's own visible text
              ("Gallery", "Film · Collage"), not just replace it with "Play
              X" — WCAG 2.5.3/axe's label-content-name-mismatch: a voice-
              control user who sees "GALLERY" on screen and says "click
              Gallery" needs that word in the accessible name too. */}
          <RegionLabel
            onClick={() => useFilmControllerStore.getState().reveal()}
            aria-label={`Gallery, Film · Collage — ${film ? `play ${film.title}` : "play the film"}`}
            title="Gallery"
            subtitle="Film · Collage"
            className="h-full w-full justify-end bg-cover bg-center"
            style={{
              backgroundImage: posterUrl
                ? `linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.1) 60%), url(${posterUrl})`
                : undefined,
              backgroundColor: posterUrl ? undefined : "#111",
            }}
          />
        </Region>

        <Collage
          centerX={getViewpoint("collage").x}
          centerY={getViewpoint("collage").y}
          onOpenPhoto={(id) => navigate(`/gallery/photo/${id}`)}
        />

        <PhotoViewer
          photos={photos ?? []}
          openId={openPhotoId}
          onClose={() => navigate("/gallery", { replace: true })}
          onNavigate={(id) => navigate(`/gallery/photo/${id}`, { replace: true })}
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
        </>
      )}
    </>
  );
}
