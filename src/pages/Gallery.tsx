import { useEffect } from "react";

import { Board } from "@/canvas/Board";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint } from "@/canvas/viewpoints";
import { useFilmControllerStore } from "@/features/film/filmControllerStore";
import { useFilm } from "@/features/film/lib/useFilm";
import { siteMediaUrl } from "@/lib/storage";

/**
 * The Gallery region, with the film as a node. The film itself renders via
 * FilmStage's globally-mounted full-screen layer (T8), not inside this
 * component — reveal()/hide() here just toggle that layer on/off, so the
 * single <video> element is never recreated by route changes and the
 * first-watch gate (T10) can never be bypassed by navigating away and back:
 * its state lives in gateStore/localStorage, independent of this route's
 * mount lifecycle. Semantic zoom, real node data and the photo collage are
 * Phase 2 (docs/02-canvas-spec.md §5; the placeholder below is explicitly
 * out of scope for v1 beyond a marker).
 */
export default function Gallery() {
  const { data: film } = useFilm();
  const posterUrl = film?.media.posterPath ? siteMediaUrl(film.media.posterPath) : undefined;

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

        {import.meta.env.DEV && (
          <div
            style={{
              position: "absolute",
              bottom: -32,
              left: 0,
              fontFamily: "sans-serif",
              fontSize: 12,
              color: "#888",
            }}
          >
            Collage placeholder — Phase 2
          </div>
        )}
      </Region>
    </Board>
  );
}
