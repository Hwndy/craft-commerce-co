import { FilmPlayer } from "@/features/film/components/FilmPlayer";

/**
 * Dev-only route (not linked from the app) to verify T7's "done when":
 * the published film plays, with buffering/error states reachable. The
 * real Gallery route (with the full-screen layer, gate, controls) is
 * T9–T12's job.
 */
export default function DevFilm() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <FilmPlayer />
    </div>
  );
}
