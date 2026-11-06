export interface FloodOverlayProps {
  /** 0..1. Driven by EntryOrchestrator; never decreases before the reveal. */
  opacity: number;
}

/**
 * The light-flood plane: a radial gradient whose opacity ramps monotonically
 * to full brightness, then fades on reveal. Pure CSS — no flashing, since
 * opacity only ever moves in one direction at a time (enforced by the
 * orchestrator, not by this component).
 */
export function FloodOverlay({ opacity }: FloodOverlayProps) {
  if (opacity <= 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 30,
        opacity,
        background:
          "radial-gradient(circle at center, #ffffff 0%, #fff7d6 35%, transparent 70%)",
      }}
    />
  );
}
