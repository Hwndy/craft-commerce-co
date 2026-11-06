import { useEffect, useRef } from "react";

export interface RaysCanvasProps {
  /** 0..1 */
  intensity: number;
}

/**
 * Additive light rays from the centre, drawn on a 2D canvas (not DOM/CSS,
 * per docs/02-canvas-spec.md's intent of keeping heavy per-frame drawing
 * off the DOM). Device pixel ratio is capped at 2 to bound per-frame cost.
 */
export function RaysCanvas({ intensity }: RaysCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.clearRect(0, 0, w, h);
    if (intensity <= 0) return;

    const cx = w / 2;
    const cy = h / 2;
    const rayCount = 14;
    const maxLength = Math.max(w, h) * 0.75 * intensity;

    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      // Slight per-ray length variation so it doesn't read as a perfect
      // mechanical starburst.
      const length = maxLength * (0.7 + 0.3 * Math.abs(Math.sin(i * 1.7)));
      const x2 = cx + Math.cos(angle) * length;
      const y2 = cy + Math.sin(angle) * length;
      const gradient = ctx.createLinearGradient(cx, cy, x2, y2);
      gradient.addColorStop(0, `rgba(255, 247, 214, ${0.5 * intensity})`);
      gradient.addColorStop(1, "rgba(255, 247, 214, 0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 6 * dpr * intensity;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    />
  );
}
