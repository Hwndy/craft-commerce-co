import { Board } from "@/canvas/Board";
import { CanvasChrome } from "@/canvas/CanvasChrome";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint } from "@/canvas/viewpoints";

/**
 * Dev-only route (not linked from the app, and — per docs/decisions.md
 * D-30-adjacent T2 finding — unreachable from any `vite build` output,
 * only `vite dev`) for manually sanity-checking the canvas engine,
 * including T5's minimap/guided-mode/Home chrome. CanvasChrome isn't
 * wired into the real Gallery page yet — see its own doc comment for why
 * (that lands with T10's gate integration).
 */
export default function DevCanvas() {
  const flyTo = useCameraStore((state) => state.flyTo);
  const isFlying = useCameraStore((state) => state.isFlying);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", background: "#111" }}>
      <Board>
        <Region
          id="landing"
          title="Landing (test)"
          x={-400}
          y={-300}
          width={800}
          height={600}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#1a1a2e",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
            }}
          >
            Landing region
          </div>
        </Region>
        <Region
          id="gallery"
          title="Gallery (test)"
          x={1600}
          y={-300}
          width={800}
          height={600}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#16213e",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "sans-serif",
            }}
          >
            Gallery region
          </div>
        </Region>
      </Board>
      <CanvasChrome />
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 10, display: "flex", gap: 8 }}>
        <button
          type="button"
          disabled={isFlying}
          onClick={() => flyTo(getViewpoint("landing"))}
        >
          Fly to landing
        </button>
        <button
          type="button"
          disabled={isFlying}
          onClick={() => flyTo(getViewpoint("gallery"))}
        >
          Fly to gallery
        </button>
      </div>
    </div>
  );
}
