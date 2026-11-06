import { Board } from "@/canvas/Board";
import { Region } from "@/canvas/Region";
import { useCameraStore } from "@/canvas/store";
import { getViewpoint } from "@/canvas/viewpoints";

/**
 * Dev-only route (not linked from the app) to verify T5's "done when":
 * the camera can fly between two test regions. Not part of the public
 * site — Phase 2 replaces ad hoc regions like these with real ones.
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
      <div style={{ position: "fixed", top: 16, left: 16, zIndex: 10, display: "flex", gap: 8 }}>
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
