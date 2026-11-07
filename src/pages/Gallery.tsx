import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Board } from "@/canvas/Board";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint } from "@/canvas/viewpoints";
import { Collage } from "@/features/collage/Collage";
import { useCollagePhotos } from "@/features/collage/lib/useCollagePhotos";
import { PhotoViewer } from "@/features/collage/PhotoViewer";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";
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
  const openPhotoId = photoIdFromSplat(params["*"]);

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
    <Board>
      <Region id="gallery" title="Gallery" x={1600} y={-300} width={800} height={600}>
        <button
          type="button"
          onClick={() => useFilmControllerStore.getState().reveal()}
          aria-label={film ? `Play ${film.title}` : "Film"}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            cursor: "pointer",
            background: posterUrl
              ? `#000 url(${posterUrl}) center / cover no-repeat`
              : "#111",
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
  );
}
