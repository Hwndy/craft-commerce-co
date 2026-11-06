import { useFilmControllerStore } from "@/features/film/filmControllerStore";

/**
 * Dev-only route (not linked from the app) to verify T8's three autoplay
 * paths against the real FilmStage (mounted once in App.tsx):
 * - "Simulate Click to enter + reveal": prime() inside this click, then
 *   reveal() — the common path, should land on autoplay or muted.
 * - "Simulate direct /gallery visit": reveal() with no prior prime() —
 *   no gesture credit, should land on the play-button fallback.
 * The real Gallery route (T12) wires reveal()/start() into the actual
 * navigation instead of these buttons.
 */
export default function DevFilm() {
  const prime = useFilmControllerStore((s) => s.prime);
  const reveal = useFilmControllerStore((s) => s.reveal);
  const reset = useFilmControllerStore((s) => s.reset);
  const hide = useFilmControllerStore((s) => s.hide);
  const fallback = useFilmControllerStore((s) => s.fallback);
  const isPrimed = useFilmControllerStore((s) => s.isPrimed);
  const isRevealed = useFilmControllerStore((s) => s.isRevealed);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111", color: "#fff" }}>
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 100, display: "flex", flexDirection: "column", gap: 8, fontFamily: "sans-serif" }}>
        <button
          type="button"
          onClick={() => {
            prime();
            reveal();
          }}
        >
          Simulate Click to enter + reveal
        </button>
        <button
          type="button"
          onClick={() => reveal()}
        >
          Simulate direct /gallery visit (no prime)
        </button>
        <button
          type="button"
          onClick={() => {
            hide();
            reset();
          }}
        >
          Reset
        </button>
        <p>
          isPrimed: {String(isPrimed)} · isRevealed: {String(isRevealed)} · fallback: {fallback}
        </p>
      </div>
    </div>
  );
}
